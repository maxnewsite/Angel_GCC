import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { callClaudeJSON, describeAIError, extractFromPDF } from "@/lib/anthropic";
import { resolveModel } from "@/lib/models";
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
  buildCompanyContext,
} from "@/lib/prompts";
import {
  CRITERIA_SCHEMA,
  EXTRACTION_SCHEMA,
  FLAGS_SCHEMA,
  RECOMMENDATION_SCHEMA,
  RESEARCH_SCHEMA,
  type CriterionResult,
  type DeckExtraction,
  type FlagResult,
  type MarketResearch,
  type RecommendationResult,
} from "@/lib/schemas";
import type { CriterionScore, ReportInsights, Submission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const TOTAL_STEPS = 6;
const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000;

const PLACEHOLDER_VALUES = new Set(["not provided", "n/a", "na", "none", "unknown", "null", "-", "—", ""]);

function isProvided(value: unknown): value is string {
  return typeof value === "string" && !PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function computeExtractionStats(extraction: DeckExtraction | null) {
  if (!extraction) return { fieldsTotal: 0, fieldsPopulated: 0, wordCount: 0 };
  const values = Object.entries(extraction)
    .filter(([k]) => k !== "missing_information")
    .map(([, v]) => v);
  return {
    fieldsTotal: values.length,
    fieldsPopulated: values.filter(isProvided).length,
    wordCount: values
      .filter(isProvided)
      .reduce((sum, v) => sum + v.trim().split(/\s+/).length, 0),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Guarantees exactly one well-formed score per criterion, in catalogue order. */
function normalizeScores(results: CriterionResult[] | null): CriterionScore[] {
  return SCREENING_CRITERIA.map((c) => {
    const r = results?.find((s) => s.key === c.key);
    return {
      criterion: c.name,
      key: c.key,
      weight: c.weight,
      score: r ? Math.min(5, Math.max(1, Math.round(r.score))) : 3,
      confidence: r?.confidence ?? "low",
      rationale: r?.rationale ?? "Not scored — re-run the analysis to score this criterion.",
    };
  });
}

function founderInputsFor(s: Submission): string {
  return [
    s.sector ? `Sector: ${s.sector}` : "",
    s.hq_location ? `Location: ${s.hq_location}` : "",
    s.website ? `Website: ${s.website}` : "",
    s.founding_date ? `Founded: ${s.founding_date}` : "",
    s.description ? `Description: ${s.description}` : "",
    s.team_info ? `Team: ${s.team_info}` : "",
    s.traction_info ? `Traction: ${s.traction_info}` : "",
    s.business_model ? `Business Model: ${s.business_model}` : "",
    s.funding_ask ? `Funding Ask: ${s.funding_ask}` : "",
    s.use_of_funds ? `Use of Funds: ${s.use_of_funds}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pitches uploaded in bulk only have a file-name placeholder; fill empty
 * submission fields from the deck so the dashboard shows real data.
 */
function backfillFromDeck(s: Submission, d: DeckExtraction, hasFounderInputs: boolean) {
  const update: Record<string, string> = {};
  const fill = (column: keyof Submission, value: string) => {
    if (!s[column] && isProvided(value)) update[column] = value.slice(0, 2000);
  };
  if (!hasFounderInputs && isProvided(d.startup_name)) update.startup_name = d.startup_name.slice(0, 200);
  fill("website", d.website);
  fill("sector", d.sector);
  fill("hq_location", d.hq_location);
  fill("description", d.one_liner);
  fill("team_info", d.team);
  fill("traction_info", d.traction);
  fill("business_model", d.business_model);
  fill("funding_ask", d.funding_ask);
  fill("use_of_funds", d.use_of_funds);
  return update;
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const denied = await requireAdmin(request, supabase);
  if (denied) return denied;

  const { submission_id, model } = await request.json().catch(() => ({}));
  if (!submission_id) {
    return Response.json({ error: "submission_id required" }, { status: 400 });
  }
  const aiModel = resolveModel(model);

  const { data: submission, error: subErr } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submission_id)
    .single<Submission>();
  if (subErr || !submission) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      // The client may disconnect mid-run; never let that crash the pipeline.
      const send = (payload: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          open = false;
        }
      };
      const progress = (step: number, message: string) => send({ step, total: TOTAL_STEPS, message });
      const warnings: string[] = [];
      const warn = (step: number, message: string, err: unknown) => {
        const detail = describeAIError(err);
        console.error(`[analyze ${submission_id}] step ${step}: ${message}`, err);
        warnings.push(`${message}: ${detail}`);
        progress(step, `${message} — continuing...`);
      };

      const previousStatus = submission.status;

      try {
        await supabase
          .from("submissions")
          .update({ status: "analyzing", updated_at: new Date().toISOString() })
          .eq("id", submission_id);

        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .eq("submission_id", submission_id);

        const founderInputs = founderInputsFor(submission);
        const hasFounderInputs = founderInputs.length > 0;
        let startupName = submission.startup_name;

        // ── STEP 1: Pitch deck extraction ──────────────────────────────
        progress(1, "Reading pitch deck...");

        const pitchDeck =
          documents?.find((d) => d.file_type === "pitch_deck") ??
          documents?.find((d) => String(d.file_name).toLowerCase().endsWith(".pdf"));

        let extraction: DeckExtraction | null = null;
        let extractionError = "No pitch deck uploaded";

        if (pitchDeck) {
          try {
            const { data: fileData, error: dlErr } = await supabase.storage
              .from("submissions")
              .download(pitchDeck.storage_path);
            if (dlErr || !fileData) throw new Error(`Could not download the pitch deck: ${dlErr?.message ?? "unknown error"}`);

            const base64 = Buffer.from(await fileData.arrayBuffer()).toString("base64");
            extraction = await withTimeout(
              extractFromPDF<DeckExtraction>(
                PITCH_DECK_EXTRACTION_SYSTEM,
                PITCH_DECK_EXTRACTION_USER,
                EXTRACTION_SCHEMA,
                base64,
                { model: aiModel, maxTokens: 8000, onProgress: (m) => progress(1, m) }
              ),
              EXTRACTION_TIMEOUT_MS,
              "Pitch deck extraction timed out"
            );
          } catch (err) {
            extractionError = describeAIError(err);
            warn(1, "Pitch deck extraction failed", err);
          }
        }

        if (!extraction && !hasFounderInputs) {
          throw new Error(`Nothing to analyse — ${extractionError}.`);
        }

        if (extraction) {
          const update = backfillFromDeck(submission, extraction, hasFounderInputs);
          if (Object.keys(update).length > 0) {
            const { error: backfillErr } = await supabase
              .from("submissions")
              .update(update)
              .eq("id", submission_id);
            if (backfillErr) console.error(`[analyze ${submission_id}] backfill failed:`, backfillErr.message);
            else if (update.startup_name) startupName = update.startup_name;
          }
        }

        send({
          step: 1,
          total: TOTAL_STEPS,
          extractionStats: computeExtractionStats(extraction),
          startup_name: startupName,
        });

        const extractionText = extraction
          ? JSON.stringify(extraction, null, 2)
          : `No pitch deck content available (${extractionError}). Analyse the founder-provided information only.`;
        const baseContext = buildCompanyContext({
          founderInputs: hasFounderInputs ? `Startup: ${startupName}\n${founderInputs}` : "",
          extraction: extractionText,
        });

        // ── STEP 2: Market research ────────────────────────────────────
        progress(2, "Researching market and competitors...");

        let marketResearch: MarketResearch = {
          market_size: "Unable to determine",
          competitors: [],
          trends: [],
          sources: [],
          summary: "Market research unavailable — re-run the analysis to generate this section.",
        };
        try {
          marketResearch = await callClaudeJSON<MarketResearch>(
            RESEARCH_SYSTEM,
            buildResearchUser(baseContext),
            RESEARCH_SCHEMA,
            { model: aiModel, maxTokens: 6000 }
          );
        } catch (err) {
          warn(2, "Market research unavailable", err);
        }

        const fullContext = buildCompanyContext({
          founderInputs: hasFounderInputs ? `Startup: ${startupName}\n${founderInputs}` : "",
          extraction: extractionText,
          research: JSON.stringify(marketResearch, null, 2),
        });

        // ── STEPS 3 + 4: Criteria scoring and flags run in parallel ────
        progress(3, "Scoring 7 investment criteria...");

        const criteriaPromise = callClaudeJSON<{ scores: CriterionResult[] }>(
          SEVEN_CRITERIA_SYSTEM,
          buildSevenCriteriaUser(fullContext),
          CRITERIA_SCHEMA,
          { model: aiModel, maxTokens: 6000 }
        );
        const flagsPromise = callClaudeJSON<{ green_flags: FlagResult[]; red_flags: FlagResult[] }>(
          YC_FLAGS_SYSTEM,
          buildYCFlagsUser(fullContext),
          FLAGS_SCHEMA,
          { model: aiModel, maxTokens: 6000 }
        );
        // Avoid unhandled rejections while the other call is awaited
        criteriaPromise.catch(() => {});
        flagsPromise.catch(() => {});

        let criteriaResults: CriterionResult[] | null = null;
        try {
          criteriaResults = (await criteriaPromise).scores;
        } catch (err) {
          warn(3, "Criteria scoring failed, neutral scores used", err);
        }
        const criteriaScores = normalizeScores(criteriaResults);

        progress(4, "Detecting green & red flags...");
        let flags: { green_flags: FlagResult[]; red_flags: FlagResult[] } = { green_flags: [], red_flags: [] };
        try {
          flags = await flagsPromise;
        } catch (err) {
          warn(4, "Flag detection unavailable", err);
        }

        // ── STEP 5: Recommendation ─────────────────────────────────────
        progress(5, "Writing investment recommendation...");

        const weightedScore = computeWeightedScore(criteriaScores);
        let recommendation: RecommendationResult = {
          score_adjustment: 0,
          recommendation: "Analysis partially completed. Review the criteria scores below.",
          executive_summary: "The recommendation step was unavailable. Re-run the analysis for a complete report.",
          key_strengths: [],
          key_risks: [],
          due_diligence_questions: [],
          detailed_rationale: "",
        };
        try {
          recommendation = await callClaudeJSON<RecommendationResult>(
            RECOMMENDATION_SYSTEM,
            buildRecommendationUser({
              company: fullContext,
              criteriaScores: JSON.stringify(criteriaScores, null, 2),
              weightedScore,
              flags: JSON.stringify(flags, null, 2),
            }),
            RECOMMENDATION_SCHEMA,
            { model: aiModel, maxTokens: 8000 }
          );
        } catch (err) {
          warn(5, "Recommendation unavailable", err);
        }

        const adjustment = Math.max(-10, Math.min(10, Math.round(recommendation.score_adjustment || 0)));
        const overallScore = Math.max(0, Math.min(100, weightedScore + adjustment));

        // ── STEP 6: Save report ────────────────────────────────────────
        progress(6, "Saving analysis report...");

        const insights: ReportInsights = {
          model: aiModel,
          key_strengths: recommendation.key_strengths,
          key_risks: recommendation.key_risks,
          due_diligence_questions: recommendation.due_diligence_questions,
          missing_information: extraction?.missing_information ?? [],
          weighted_score: weightedScore,
          score_adjustment: adjustment,
          warnings,
          deck: extraction
            ? {
                one_liner: extraction.one_liner,
                stage: extraction.stage,
                sector: extraction.sector,
                hq_location: extraction.hq_location,
                website: extraction.website,
              }
            : undefined,
        };

        const report = {
          submission_id,
          overall_score: overallScore,
          recommendation: recommendation.recommendation,
          executive_summary: recommendation.executive_summary,
          criteria_scores: criteriaScores,
          green_flags: flags.green_flags,
          red_flags: flags.red_flags,
          market_research: marketResearch,
          detailed_rationale: recommendation.detailed_rationale,
          raw_ai_responses: { model: aiModel, extraction, warnings },
          insights,
        };

        // Remove the previous report only once the new one is ready
        await supabase.from("analysis_reports").delete().eq("submission_id", submission_id);

        let { error: reportErr } = await supabase.from("analysis_reports").insert(report);
        if (reportErr && reportErr.message.includes("insights")) {
          // Database not yet migrated (supabase/migration_report_insights.sql)
          console.warn("[analyze] insights column missing — saving without it");
          const { insights: _omit, ...legacyReport } = report;
          void _omit;
          ({ error: reportErr } = await supabase.from("analysis_reports").insert(legacyReport));
        }
        if (reportErr) throw new Error("Failed to save report: " + reportErr.message);

        await supabase
          .from("submissions")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", submission_id);

        send({
          step: TOTAL_STEPS,
          total: TOTAL_STEPS,
          message: warnings.length ? `Analysis complete with ${warnings.length} warning(s)` : "Analysis complete!",
          done: true,
          overall_score: overallScore,
          recommendation: recommendation.recommendation,
          startup_name: startupName,
        });
      } catch (err) {
        console.error(`[analyze ${submission_id}] failed:`, err);
        await supabase
          .from("submissions")
          .update({
            status: previousStatus === "analyzing" ? "in_review" : previousStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", submission_id);
        send({ error: describeAIError(err) });
      } finally {
        if (open) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
