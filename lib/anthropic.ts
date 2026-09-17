import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL } from "./models";

// Native PDF input is capped at 32 MB per request (base64 counts toward it).
// Above this size we skip the native path and go straight to text chunks.
const NATIVE_PDF_MAX_BASE64 = 24 * 1024 * 1024;
const PAGES_PER_CHUNK = 30;
const CHUNK_CONCURRENCY = 3;

// Inline types for pdf2json (package ships no TS types)
type PDFText = { R: { T: string }[] };
type PDFPage = { Texts: PDFText[] };
type PDFData = { Pages: PDFPage[] };
type PDFParserCtor = new (ctx: null, verbosity: number) => {
  on(event: "pdfParser_dataError", cb: (e: { parserError: Error }) => void): void;
  on(event: "pdfParser_dataReady", cb: (data: PDFData) => void): void;
  parseBuffer(buf: Buffer): void;
};

export type JSONSchema = Record<string, unknown>;

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // 3 minutes per attempt — PDF extraction on large decks can be slow
      timeout: 3 * 60 * 1000,
      // The SDK retries 408/409/429/5xx (including 529 overloaded) and
      // connection errors with exponential backoff, honouring retry-after.
      maxRetries: 4,
    });
  }
  return client;
}

/** Error with a message that is safe to show to admins in the UI. */
export class AIError extends Error {}

/** Translates SDK errors into short, actionable messages. */
export function describeAIError(err: unknown): string {
  if (err instanceof AIError) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "Anthropic API key is missing or invalid (check ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.PermissionDeniedError)
    return "The Anthropic API key does not have access to this model.";
  if (err instanceof Anthropic.RateLimitError)
    return "Anthropic rate limit reached. Wait a minute and retry, or screen fewer pitches at once.";
  if (err instanceof Anthropic.BadRequestError)
    return `The AI request was rejected: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return "The AI request timed out.";
  if (err instanceof Anthropic.APIConnectionError)
    return "Could not reach the Anthropic API (network error).";
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return "The AI service is temporarily overloaded. Please try again in a few minutes.";
    return `AI service error (${err.status ?? "unknown"}).`;
  }
  return err instanceof Error ? err.message : "Unknown AI error";
}

interface JSONCallOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Calls Claude with structured outputs so the response is guaranteed to be
 * JSON matching `schema`. Throws AIError on truncation or refusal.
 */
export async function callClaudeJSON<T>(
  systemPrompt: string,
  content: string | Anthropic.ContentBlockParam[],
  schema: JSONSchema,
  options?: JSONCallOptions
): Promise<T> {
  const response = await getAnthropicClient().messages.create({
    model: options?.model ?? DEFAULT_MODEL,
    max_tokens: options?.maxTokens ?? 8000,
    system: systemPrompt,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema } },
  });

  if (response.stop_reason === "refusal") {
    throw new AIError("The model declined to analyse this content.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIError("The AI response was cut off (output too long).");
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AIError("The AI returned malformed JSON.");
  }
}

/**
 * Extracts structured data from a PDF.
 * - Up to ~24 MB: sent natively so Claude sees the slides (text + visuals).
 * - Larger, or if the native request is rejected (e.g. too many pages):
 *   the text layer is split into chunks, extracted in parallel, then merged.
 */
export async function extractFromPDF<T>(
  systemPrompt: string,
  instruction: string,
  schema: JSONSchema,
  pdfBase64: string,
  options?: JSONCallOptions & { onProgress?: (message: string) => void }
): Promise<T> {
  if (pdfBase64.length <= NATIVE_PDF_MAX_BASE64) {
    try {
      return await callClaudeJSON<T>(
        systemPrompt,
        [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: instruction },
        ],
        schema,
        options
      );
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      console.warn("[extractFromPDF] native PDF rejected, falling back to text:", err.message);
      options?.onProgress?.("Deck too large for direct reading — extracting text instead...");
    }
  }
  return extractFromPDFText<T>(systemPrompt, instruction, schema, pdfBase64, options);
}

async function extractFromPDFText<T>(
  systemPrompt: string,
  instruction: string,
  schema: JSONSchema,
  pdfBase64: string,
  options?: JSONCallOptions & { onProgress?: (message: string) => void }
): Promise<T> {
  const pages = await extractPages(Buffer.from(pdfBase64, "base64"));
  if (pages.join("").trim().length < 200) {
    throw new AIError("The PDF is too large to read directly and has no text layer (scanned images).");
  }

  const chunks: string[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    chunks.push(
      pages
        .slice(i, i + PAGES_PER_CHUNK)
        .map((p, j) => `--- Page ${i + j + 1} ---\n${p}`)
        .join("\n\n")
    );
  }

  let completed = 0;
  const partials = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, async (chunk, i) => {
    const result = await callClaudeJSON<T>(
      systemPrompt,
      `${instruction}\n\nThis is part ${i + 1} of ${chunks.length} of the deck's text. Extract what this part contains.\n\n<pitch_deck_text>\n${chunk}\n</pitch_deck_text>`,
      schema,
      options
    );
    completed++;
    options?.onProgress?.(`Extracting pitch deck... (part ${completed} of ${chunks.length})`);
    return result;
  });

  if (partials.length === 1) return partials[0];

  return callClaudeJSON<T>(
    systemPrompt,
    `Merge these ${partials.length} partial extractions of the same pitch deck into one. For each field keep the most complete and specific information, combining details from all parts without duplication.\n\n${partials
      .map((p, i) => `<part index="${i + 1}">\n${JSON.stringify(p)}\n</part>`)
      .join("\n")}`,
    schema,
    options
  );
}

/** Runs fn over items with at most `limit` in flight; preserves order. */
export async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>
): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Extract per-page text from a PDF buffer using pdf2json.
 * Fails fast after 60 s so a problematic PDF never hangs the pipeline.
 */
async function extractPages(buffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json") as PDFParserCtor;

  const parsePromise = new Promise<string[]>((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on("pdfParser_dataError", (e) => reject(e.parserError));
    parser.on("pdfParser_dataReady", (pdfData) => {
      const pages = pdfData.Pages.map((page) =>
        page.Texts.map((t) =>
          t.R
            .map((r) => {
              // pdf2json percent-encodes text; raw PDFs may have bare '%' chars
              try {
                return decodeURIComponent(r.T);
              } catch {
                return r.T;
              }
            })
            .join("")
        )
          .join(" ")
          .trim()
      );
      resolve(pages);
    });
    parser.parseBuffer(buffer);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AIError("PDF text extraction timed out.")), 60_000);
  });

  try {
    return await Promise.race([parsePromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
