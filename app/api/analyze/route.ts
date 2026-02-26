import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude, callClaudeWithPDF } from "@/lib/anthropic";
import { computeWeightedScore, SCREENING_CRITERIA } from "@/lib/criteria";
import {
  PITCH_DECK_EXTRACTION_SYSTEM,
  PITCH_DECK_EXTRACTION_USER,
  SEVEN_CRITERIA_SYSTEM,
  buildSevenCriteriaUser,
  YC_FLAGS_SYSTEM,
  buildYCFlagsUser,
  RECOMMENDATION_SYSTEM,
  buildRecommendationUser,
  RESEARCH_SYSTEM,
  buildResearchUser,
} from "@/lib/prompts";

/**
 * Returns true when the extraction result contains genuinely useful content.
 *
 * Checks performed:
 *  1. Known failure/fallback sentinel strings → not meaningful
 *  2. Parseable JSON  → at least MIN_MEANINGFUL_FIELDS fields must have a
 *     non-empty, non-placeholder value.
 *  3. Raw text fallback → must be longer than MIN_RAW_LENGTH characters.
 */
const EXTRACTION_SENTINELS = [
  "No pitch deck provided.",
  "Pitch deck extraction failed.",
];
const PLACEHOLDER_VALUES = new Set([
  "not provided", "n/a", "na", "none", "unknown", "null", "-", "—", "",
]);
const MIN_MEANINGFUL_FIELDS = 3;
const MIN_RAW_LENGTH = 100;

function isMeaningfulExtraction(data: string): boolean {
  const trimmed = data.trim();

  if (EXTRACTION_SENTINELS.some((s) => trimmed.startsWith(s))) return false;

  // Try to validate as a parsed JSON object
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return trimmed.length >= MIN_RAW_LENGTH;

    const meaningful = Object.values(parsed).filter((v) => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim().toLowerCase();
      return s.length > 0 && !PLACEHOLDER_VALUES.has(s);
    }).length;

    return meaningful >= MIN_MEANINGFUL_FIELDS;
  } catch {
    // Not JSON — accept if it has enough raw text
    return trimmed.length >= MIN_RAW_LENGTH;
  }
}

/**
 * Computes summary metrics for the extraction result.
 * For JSON: counts total fields, populated fields, and words across all values.
 * For raw text: reports word count only (fieldsTotal/fieldsPopulated = 0).
 */
function computeExtractionStats(
  data: string
): { fieldsTotal: number; fieldsPopulated: number; wordCount: number } {
  const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  try {
    const parsed = JSON.parse(data);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { fieldsTotal: 0, fieldsPopulated: 0, wordCount: countWords(data) };
    }

    const values = Object.values(parsed);
    const fieldsTotal = values.length;
    const fieldsPopulated = values.filter((v) => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim().toLowerCase();
      return s.length > 0 && !PLACEHOLDER_VALUES.has(s);
    }).length;
    const wordCount = values.reduce((sum, v) => {
      if (v === null || v === undefined) return sum;
      return sum + countWords(String(v));
    }, 0);

    return { fieldsTotal, fieldsPopulated, wordCount };
  } catch {
    return { fieldsTotal: 0, fieldsPopulated: 0, wordCount: countWords(data) };
  }
}

function parseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch { /* ignore */ }
    }
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch { /* ignore */ }
    }
    throw new Error("Could not parse JSON from AI response");
  }
}

/** Neutral fallback criteria scores used when the scoring step is unavailable */
const FALLBACK_CRITERIA_SCORES = SCREENING_CRITERIA.map((c) => ({
  criterion: c.name,
  key: c.key,
  weight: c.weight,
  score: 3,
  rationale: "Automated scoring unavailable — re-analyze to generate accurate scores.",
}));

const VALID_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
] as const;

export async function POST(request: NextRequest) {
  const { submission_id, model } = await request.json();

  if (!submission_id) {
    return new Response(
      JSON.stringify({ error: "submission_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Default to Haiku if not specified or unrecognized
  const aiModel: string = VALID_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";

  const encoder = new TextEncoder();
  function sse(payload: object) {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => controller.enqueue(sse(payload));
      const TOTAL_STEPS = 6;

      try {
        const supabase = createServiceClient();

        // ── Fetch submission ─────────────────────────────────────────────
        const { data: submission, error: subErr } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", submission_id)
          .single();

        if (subErr || !submission) {
          send({ error: "Submission not found" });
          controller.close();
          return;
        }

        // Delete any prior report so re-runs start fresh
        await supabase.from("analysis_reports").delete().eq("submission_id", submission_id);

        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .eq("submission_id", submission_id);

        const founderInputs = [
          `Startup: ${submission.startup_name}`,
          submission.sector       ? `Sector: ${submission.sector}`             : "",
          submission.hq_location  ? `Location: ${submission.hq_location}`      : "",
          submission.website      ? `Website: ${submission.website}`            : "",
          submission.description  ? `Description: ${submission.description}`   : "",
          submission.team_info    ? `Team: ${submission.team_info}`             : "",
          submission.traction_info? `Traction: ${submission.traction_info}`    : "",
          submission.business_model?`Business Model: ${submission.business_model}`: "",
          submission.funding_ask  ? `Funding Ask: ${submission.funding_ask}`   : "",
          submission.use_of_funds ? `Use of Funds: ${submission.use_of_funds}` : "",
        ].filter(Boolean).join("\n");

        // ── STEP 1: Pitch deck extraction (non-fatal) ────────────────────
        send({ step: 1, total: TOTAL_STEPS, message: "Extracting pitch deck data..." });

        let extractedData = "No pitch deck provided.";
        const pitchDeck = documents?.find(
          (d: { file_type: string }) => d.file_type === "pitch_deck"
        );

        if (pitchDeck) {
          try {
            const { data: fileData } = await supabase.storage
              .from("submissions")
              .download(pitchDeck.storage_path);

            if (fileData) {
              const base64 = Buffer.from(await fileData.arrayBuffer()).toString("base64");

              const extracted = await Promise.race([
                callClaudeWithPDF(
                  PITCH_DECK_EXTRACTION_SYSTEM,
                  PITCH_DECK_EXTRACTION_USER,
                  base64,
                  {
                    // PDF vision requires at least Sonnet — Haiku struggles with
                    // visually complex slides (text on gradients/images).
                    // Opus selection is respected; only Haiku gets upgraded.
                    model: aiModel === "claude-haiku-4-5-20251001" ? "claude-sonnet-4-6" : aiModel,
                    maxTokens: 4096,
                    onChunkProgress: (chunk, total) =>
                      send({ step: 1, total: TOTAL_STEPS, message: `Extracting pitch deck... (part ${chunk} of ${total})` }),
                  }
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("Pitch deck extraction timed out")), 90_000)
                ),
              ]);

              try {
                extractedData = JSON.stringify(parseJSON(extracted), null, 2);
              } catch {
                extractedData = extracted;
              }
            }
          } catch (err) {
            console.error("Step 1 failed:", err);
            extractedData = "Pitch deck extraction failed. Analysis based on founder-provided information.";
            send({ step: 1, total: TOTAL_STEPS, message: "Pitch deck extraction skipped — continuing..." });
          }
        }

        // ── STEP 1 — Extraction quality gate ────────────────────────────
        if (!isMeaningfulExtraction(extractedData)) {
          console.warn(
            `[analyze] Extraction quality gate failed for submission ${submission_id}. ` +
            `Content snippet: ${extractedData.slice(0, 200)}`
          );
          send({
            step: 1,
            total: TOTAL_STEPS,
            message: "Pitch deck extraction returned insufficient content — proceeding with founder-provided data only.",
          });
          extractedData =
            "Pitch deck extraction returned no meaningful content. Analysis is based exclusively on founder-provided information.";
        }

        // Broadcast extraction stats so the UI can show inline feedback
        const extractionStats = computeExtractionStats(extractedData);
        send({ step: 1, total: TOTAL_STEPS, extractionStats });

        // ── STEP 2: Market research (non-fatal) ──────────────────────────
        send({ step: 2, total: TOTAL_STEPS, message: "Conducting market research..." });

        let marketResearch: Record<string, unknown> = {
          market_size: "Unable to determine",
          competitors: [],
          trends: [],
          sources: [],
          summary: "Market research unavailable — re-analyze to generate this section.",
        };
        let researchRaw = "";

        try {
          researchRaw = await callClaude(
            RESEARCH_SYSTEM,
            buildResearchUser(
              submission.startup_name,
              submission.sector || "Technology",
              submission.description || ""
            ),
            { model: aiModel, maxTokens: 3000 }
          );
          try {
            marketResearch = parseJSON(researchRaw);
          } catch {
            marketResearch = { ...marketResearch, summary: researchRaw };
          }
        } catch (err) {
          console.error("Step 2 failed:", err);
          send({ step: 2, total: TOTAL_STEPS, message: "Market research unavailable — continuing..." });
        }

        const researchData = JSON.stringify(marketResearch, null, 2);

        // ── STEP 3: 7-criteria scoring (non-fatal) ───────────────────────
        send({ step: 3, total: TOTAL_STEPS, message: "Scoring 7 investment criteria..." });

        let criteriaScores: unknown[] = FALLBACK_CRITERIA_SCORES;
        let criteriaRaw = "";

        try {
          criteriaRaw = await callClaude(
            SEVEN_CRITERIA_SYSTEM,
            buildSevenCriteriaUser({ founderInputs, extractedData, researchData }),
            { model: aiModel, maxTokens: 4096 }
          );
          try {
            const parsed = parseJSON(criteriaRaw);
            criteriaScores = parsed.scores ?? parsed;
          } catch {
            // keep fallback scores
          }
        } catch (err) {
          console.error("Step 3 failed:", err);
          send({ step: 3, total: TOTAL_STEPS, message: "Criteria scoring unavailable — using defaults..." });
        }

        // ── STEP 4: YC flag detection (non-fatal) ────────────────────────
        send({ step: 4, total: TOTAL_STEPS, message: "Detecting YC-style green & red flags..." });

        let flagsResult: { green_flags: unknown[]; red_flags: unknown[] } = {
          green_flags: [],
          red_flags: [],
        };
        let flagsRaw = "";

        try {
          flagsRaw = await callClaude(
            YC_FLAGS_SYSTEM,
            buildYCFlagsUser({ founderInputs, extractedData, researchData }),
            { model: aiModel, maxTokens: 4096 }
          );
          try {
            flagsResult = parseJSON(flagsRaw);
          } catch (parseErr) {
            console.error("Step 4 — flag JSON parse failed:", parseErr);
            console.error("Step 4 — raw response snippet:", flagsRaw.slice(0, 500));
          }
        } catch (err) {
          console.error("Step 4 failed:", err);
          send({ step: 4, total: TOTAL_STEPS, message: "Flag detection unavailable — continuing..." });
        }

        // ── STEP 5: Overall recommendation (non-fatal) ───────────────────
        send({ step: 5, total: TOTAL_STEPS, message: "Generating investment recommendation..." });

        const weightedScore = computeWeightedScore(
          (criteriaScores as { key: string; score: number }[]).map((c) => ({
            key: c.key,
            score: c.score,
          }))
        );

        let overallResult = {
          overall_score: weightedScore,
          recommendation: "Analysis partially completed. Review available criteria scores.",
          executive_summary: "Some analysis steps were unavailable. Re-analyze for a complete report.",
          detailed_rationale: "",
        };
        let overallRaw = "";

        try {
          overallRaw = await callClaude(
            RECOMMENDATION_SYSTEM,
            buildRecommendationUser({
              founderInputs,
              criteriaScores: JSON.stringify(criteriaScores, null, 2),
              flags: JSON.stringify(flagsResult, null, 2),
              researchData,
            }),
            { model: aiModel, maxTokens: 4096 }
          );
          try {
            overallResult = parseJSON(overallRaw);
          } catch {
            overallResult = { ...overallResult, detailed_rationale: overallRaw };
          }
        } catch (err) {
          console.error("Step 5 failed:", err);
          send({ step: 5, total: TOTAL_STEPS, message: "Recommendation unavailable — saving partial results..." });
        }

        // ── STEP 6: Save report ──────────────────────────────────────────
        send({ step: 6, total: TOTAL_STEPS, message: "Saving analysis report..." });

        const { error: reportErr } = await supabase.from("analysis_reports").insert({
          submission_id,
          overall_score: overallResult.overall_score,
          recommendation: overallResult.recommendation,
          executive_summary: overallResult.executive_summary,
          criteria_scores: criteriaScores,
          green_flags: flagsResult.green_flags || [],
          red_flags: flagsResult.red_flags || [],
          market_research: marketResearch,
          detailed_rationale: overallResult.detailed_rationale,
          raw_ai_responses: {
            extraction: extractedData,
            research: researchRaw,
            criteria: criteriaRaw,
            flags: flagsRaw,
            overall: overallRaw,
          },
        });

        if (reportErr) {
          send({ error: "Failed to save report: " + reportErr.message });
          controller.close();
          return;
        }

        await supabase
          .from("submissions")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", submission_id);

        send({
          step: TOTAL_STEPS,
          total: TOTAL_STEPS,
          message: "Analysis complete!",
          done: true,
          overall_score: overallResult.overall_score,
          recommendation: overallResult.recommendation,
        });

      } catch (err) {
        console.error("Analysis error:", err);
        send({ error: err instanceof Error ? err.message : "Analysis failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
