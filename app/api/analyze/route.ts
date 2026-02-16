import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude, callClaudeWithPDF } from "@/lib/anthropic";
import { computeWeightedScore } from "@/lib/criteria";
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

function parseJSON(text: string) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // ignore
      }
    }
    // Try finding JSON object/array in text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // ignore
      }
    }
    throw new Error("Could not parse JSON from AI response");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { submission_id } = await request.json();
    if (!submission_id) {
      return NextResponse.json({ error: "submission_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch submission
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Fetch documents
    const { data: documents } = await supabase
      .from("documents")
      .select("*")
      .eq("submission_id", submission_id);

    // Build founder inputs text
    const founderInputs = [
      `Startup: ${submission.startup_name}`,
      submission.sector ? `Sector: ${submission.sector}` : "",
      submission.hq_location ? `Location: ${submission.hq_location}` : "",
      submission.website ? `Website: ${submission.website}` : "",
      submission.description ? `Description: ${submission.description}` : "",
      submission.team_info ? `Team: ${submission.team_info}` : "",
      submission.traction_info ? `Traction: ${submission.traction_info}` : "",
      submission.business_model ? `Business Model: ${submission.business_model}` : "",
      submission.funding_ask ? `Funding Ask: ${submission.funding_ask}` : "",
      submission.use_of_funds ? `Use of Funds: ${submission.use_of_funds}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // STEP 1: Extract pitch deck data
    let extractedData = "No pitch deck provided.";
    const pitchDeck = documents?.find((d: { file_type: string }) => d.file_type === "pitch_deck");
    if (pitchDeck) {
      const { data: fileData } = await supabase.storage
        .from("submissions")
        .download(pitchDeck.storage_path);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const base64 = buffer.toString("base64");

        const extracted = await callClaudeWithPDF(
          PITCH_DECK_EXTRACTION_SYSTEM,
          PITCH_DECK_EXTRACTION_USER,
          base64,
          { maxTokens: 4096 }
        );
        try {
          const parsed = parseJSON(extracted);
          extractedData = JSON.stringify(parsed, null, 2);
        } catch {
          extractedData = extracted;
        }
      }
    }

    // STEP 2: Market Research
    const researchRaw = await callClaude(
      RESEARCH_SYSTEM,
      buildResearchUser(
        submission.startup_name,
        submission.sector || "Technology",
        submission.description || ""
      ),
      { maxTokens: 3000 }
    );
    let marketResearch;
    try {
      marketResearch = parseJSON(researchRaw);
    } catch {
      marketResearch = {
        market_size: "Unable to determine",
        competitors: [],
        trends: [],
        sources: [],
        summary: researchRaw,
      };
    }
    const researchData = JSON.stringify(marketResearch, null, 2);

    // STEP 3: 7-Criteria Scoring
    const criteriaRaw = await callClaude(
      SEVEN_CRITERIA_SYSTEM,
      buildSevenCriteriaUser({ founderInputs, extractedData, researchData }),
      { maxTokens: 4096 }
    );
    let criteriaResult;
    try {
      criteriaResult = parseJSON(criteriaRaw);
    } catch {
      return NextResponse.json({ error: "Failed to parse criteria scores" }, { status: 500 });
    }
    const criteriaScores = criteriaResult.scores || criteriaResult;

    // STEP 4: YC Flag Detection
    const flagsRaw = await callClaude(
      YC_FLAGS_SYSTEM,
      buildYCFlagsUser({ founderInputs, extractedData, researchData }),
      { maxTokens: 3000 }
    );
    let flagsResult;
    try {
      flagsResult = parseJSON(flagsRaw);
    } catch {
      flagsResult = { green_flags: [], red_flags: [] };
    }

    // STEP 5: Overall Recommendation
    const overallRaw = await callClaude(
      RECOMMENDATION_SYSTEM,
      buildRecommendationUser({
        founderInputs,
        criteriaScores: JSON.stringify(criteriaScores, null, 2),
        flags: JSON.stringify(flagsResult, null, 2),
        researchData,
      }),
      { maxTokens: 4096 }
    );
    let overallResult;
    try {
      overallResult = parseJSON(overallRaw);
    } catch {
      // Compute score from criteria if AI fails
      const weightedScore = computeWeightedScore(
        criteriaScores.map((c: { key: string; score: number }) => ({ key: c.key, score: c.score }))
      );
      overallResult = {
        overall_score: weightedScore,
        recommendation: "Analysis completed. Review the detailed criteria scores and flags.",
        executive_summary: "See detailed analysis below.",
        detailed_rationale: overallRaw,
      };
    }

    // STEP 6: Save report
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
      return NextResponse.json({ error: "Failed to save report: " + reportErr.message }, { status: 500 });
    }

    // Update submission status
    await supabase
      .from("submissions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", submission_id);

    return NextResponse.json({
      success: true,
      overall_score: overallResult.overall_score,
      recommendation: overallResult.recommendation,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
