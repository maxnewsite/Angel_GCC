import Anthropic from "@anthropic-ai/sdk";

// PDFs larger than this (base64 length) are split into page-text chunks
const PDF_SIZE_THRESHOLD = 5 * 1024 * 1024; // ~5 MB base64 ≈ ~3.75 MB actual PDF
const PAGES_PER_CHUNK = 12;

// Inline types for pdf2json (package ships no TS types)
type PDFText = { R: { T: string }[] };
type PDFPage = { Texts: PDFText[] };
type PDFData = { Pages: PDFPage[] };
type PDFParserCtor = new (ctx: null, verbosity: number) => {
  on(event: "pdfParser_dataError", cb: (e: { parserError: Error }) => void): void;
  on(event: "pdfParser_dataReady", cb: (data: PDFData) => void): void;
  parseBuffer(buf: Buffer): void;
};

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      // 2 minutes per individual API call
      timeout: 2 * 60 * 1000,
      // Disable the SDK's own retry logic — our withRetry controls everything
      maxRetries: 0,
    });
  }
  return client;
}

/**
 * Retries fn up to maxRetries times on HTTP 529 (overloaded) with exponential backoff.
 * The SDK's own retry is disabled (maxRetries: 0) so this is the single source of truth.
 * Any non-529 error is rethrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isOverloaded = err instanceof Anthropic.APIError && err.status === 529;
      if (!isOverloaded) throw err; // surface non-529 errors immediately

      if (attempt < maxRetries - 1) {
        // Equal jitter: wait base/2 + random(0, base/2) to spread retries
        const base = Math.pow(2, attempt) * 3000; // 3 s, 6 s, 12 s, 24 s, 48 s
        const waitMs = base / 2 + Math.random() * (base / 2);
        console.warn(
          `Claude API overloaded (attempt ${attempt + 1}/${maxRetries}), retrying in ${(waitMs / 1000).toFixed(1)}s…`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  // All retries exhausted — throw a human-readable message
  throw new Error("The AI service is temporarily overloaded. Please try again in a few minutes.");
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const anthropic = getAnthropicClient();
  return withRetry(async () => {
    const response = await anthropic.messages.create({
      model: options?.model ?? "claude-haiku-4-5-20251001",
      max_tokens: options?.maxTokens ?? 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    if (block.type === "text") return block.text;
    return "";
  });
}

/**
 * Sends a PDF to Claude for analysis.
 * - Small PDFs (≤ PDF_SIZE_THRESHOLD) → native document block, one call.
 * - Large PDFs → text extracted page-by-page, split into parallel chunks,
 *   then merged. Falls back to native document path if no text layer found.
 *
 * onChunkProgress is called after each chunk completes so callers can
 * stream progress updates.
 */
export async function callClaudeWithPDF(
  systemPrompt: string,
  userMessage: string,
  pdfBase64: string,
  options?: {
    model?: string;
    maxTokens?: number;
    onChunkProgress?: (chunk: number, total: number) => void;
  }
): Promise<string> {
  if (pdfBase64.length <= PDF_SIZE_THRESHOLD) {
    return sendFullPDF(systemPrompt, userMessage, pdfBase64, options);
  }
  return sendChunkedPDF(systemPrompt, userMessage, pdfBase64, options);
}

async function sendFullPDF(
  systemPrompt: string,
  userMessage: string,
  pdfBase64: string,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const anthropic = getAnthropicClient();
  return withRetry(async () => {
    const response = await anthropic.messages.create({
      model: options?.model ?? "claude-haiku-4-5-20251001",
      max_tokens: options?.maxTokens ?? 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: userMessage },
          ],
        },
      ],
    });
    const block = response.content[0];
    if (block.type === "text") return block.text;
    return "";
  });
}

/**
 * Extract per-page text from a PDF buffer using pdf2json.
 * Fails fast after 30 s so a problematic PDF never hangs the pipeline.
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

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("PDF text extraction timed out (30 s)")), 30_000)
  );

  return Promise.race([parsePromise, timeoutPromise]);
}

async function sendChunkedPDF(
  systemPrompt: string,
  userMessage: string,
  pdfBase64: string,
  options?: {
    model?: string;
    maxTokens?: number;
    onChunkProgress?: (chunk: number, total: number) => void;
  }
): Promise<string> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const pages = await extractPages(buffer);

  // If no readable text layer (scanned / image-only), use native document path
  const totalText = pages.join("").trim();
  if (totalText.length < 200) {
    return sendFullPDF(systemPrompt, userMessage, pdfBase64, options);
  }

  // Split pages into fixed-size chunks
  const chunks: string[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    chunks.push(pages.slice(i, i + PAGES_PER_CHUNK).join("\n\n"));
  }

  // Process chunks in parallel — each is independent
  const chunkResults = await Promise.all(
    chunks.map(async (chunk, i) => {
      const msg = `${userMessage}\n\n[Part ${i + 1} of ${chunks.length} — extract what you can from this portion.]\n\nPITCH DECK TEXT:\n${chunk}`;
      const result = await callClaude(systemPrompt, msg, {
        maxTokens: options?.maxTokens ?? 4096,
      });
      options?.onChunkProgress?.(i + 1, chunks.length);
      return result;
    })
  );

  if (chunkResults.length === 1) return chunkResults[0];

  // Merge partial extractions into one coherent JSON
  const mergeMsg = `Merge the following ${chunkResults.length} partial pitch deck extractions into a single JSON object. For each field, use the most complete and accurate value found across all parts.

${chunkResults.map((r, i) => `--- PART ${i + 1} ---\n${r}`).join("\n\n")}

Return a single merged JSON with the same schema. Return ONLY valid JSON. No markdown formatting.`;

  return callClaude(systemPrompt, mergeMsg, {
    maxTokens: options?.maxTokens ?? 4096,
  });
}
