import { SCREENING_CRITERIA } from "./criteria";
import { YC_FLAGS_CATALOG } from "./flags-catalog";

const criteriaText = SCREENING_CRITERIA.map(
  (c, i) =>
    `${i + 1}. ${c.name} (weight: ${c.weight})\n   Description: ${c.description}\n   Scoring:\n${Object.entries(c.scoring_guide)
      .map(([k, v]) => `     ${k}/5: ${v}`)
      .join("\n")}`
).join("\n\n");

const greenFlagsText = YC_FLAGS_CATALOG.filter((f) => f.type === "green")
  .map((f) => `- [${f.category}] ${f.flag}: ${f.description}`)
  .join("\n");

const redFlagsText = YC_FLAGS_CATALOG.filter((f) => f.type === "red")
  .map((f) => `- [${f.category}] ${f.flag}: ${f.description}`)
  .join("\n");

export const PITCH_DECK_EXTRACTION_SYSTEM = `You are an expert startup analyst. Your job is to extract structured information from pitch decks and startup documents.
Extract as much relevant information as possible. Be thorough and precise. If information is not present, note it as "Not provided".`;

export const PITCH_DECK_EXTRACTION_USER = `Analyze this pitch deck and extract the following information in JSON format:

{
  "startup_name": "name of the startup",
  "problem": "what problem they're solving",
  "solution": "their proposed solution",
  "team": "founder backgrounds, team size, key hires",
  "traction": "users, revenue, growth rates, key metrics",
  "market": "target market, TAM/SAM/SOM estimates, market trends",
  "business_model": "how they make money, pricing, unit economics",
  "competition": "competitors mentioned, differentiation claimed",
  "financials": "revenue, burn rate, projections if mentioned",
  "funding_ask": "amount raising, valuation, instrument type",
  "use_of_funds": "how they plan to use the investment",
  "notable_claims": "any notable claims or achievements mentioned"
}

Return ONLY valid JSON. No markdown formatting.`;

export const SEVEN_CRITERIA_SYSTEM = `You are a senior angel investor analyst with 20+ years of experience evaluating early-stage startups.
You must score this startup on exactly 7 criteria, each on a scale of 1-5.
Be rigorous, evidence-based, and honest in your assessment. Do not inflate scores.
Every score must be justified with specific evidence from the provided data.

THE 7 SCREENING CRITERIA:

${criteriaText}`;

export function buildSevenCriteriaUser(data: {
  founderInputs: string;
  extractedData: string;
  researchData: string;
}): string {
  return `Based on ALL the data below, score this startup on each of the 7 criteria (1-5).

## Founder-Provided Information:
${data.founderInputs}

## Extracted from Pitch Deck:
${data.extractedData}

## Market Research Findings:
${data.researchData}

Return your analysis as JSON with this exact structure:
{
  "scores": [
    {
      "criterion": "Market Opportunity",
      "key": "market_opportunity",
      "weight": 1.5,
      "score": <1-5>,
      "rationale": "<detailed 2-3 sentence rationale with specific evidence>"
    },
    {
      "criterion": "Team Quality",
      "key": "team_quality",
      "weight": 1.5,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    },
    {
      "criterion": "Traction",
      "key": "traction",
      "weight": 1.3,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    },
    {
      "criterion": "Business Model",
      "key": "business_model",
      "weight": 1.2,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    },
    {
      "criterion": "Defensibility",
      "key": "defensibility",
      "weight": 1.0,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    },
    {
      "criterion": "Execution Risk",
      "key": "execution_risk",
      "weight": 1.0,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    },
    {
      "criterion": "Valuation Fairness",
      "key": "valuation_fairness",
      "weight": 0.8,
      "score": <1-5>,
      "rationale": "<detailed rationale>"
    }
  ]
}

Return ONLY valid JSON. No markdown formatting.`;
}

export const YC_FLAGS_SYSTEM = `You are a YC-trained startup evaluator. Your job is to identify green flags (strengths/positive signals) and red flags (warnings/concerns) for this startup.

Use the following YC investment framework categories: Team, Traction, Market, Product, Business Model, Deal Terms.

Reference flags to look for:

GREEN FLAGS:
${greenFlagsText}

RED FLAGS:
${redFlagsText}

Be specific and evidence-based. Only flag items where you have evidence. Each flag must include the supporting evidence.`;

export function buildYCFlagsUser(data: {
  founderInputs: string;
  extractedData: string;
  researchData: string;
}): string {
  return `Analyze this startup and identify all green flags and red flags.

## Founder-Provided Information:
${data.founderInputs}

## Extracted from Pitch Deck:
${data.extractedData}

## Market Research Findings:
${data.researchData}

Return as JSON:
{
  "green_flags": [
    {"flag": "<flag name>", "category": "<Team|Traction|Market|Product|Business Model|Deal Terms>", "evidence": "<specific evidence>"}
  ],
  "red_flags": [
    {"flag": "<flag name>", "category": "<Team|Traction|Market|Product|Business Model|Deal Terms>", "evidence": "<specific evidence>"}
  ]
}

Return ONLY valid JSON. No markdown formatting.`;
}

export const RECOMMENDATION_SYSTEM = `You are a senior angel investor making a final investment recommendation.
You have access to the complete analysis including 7-criteria scores, YC-style flags, and market research.

Score scale (0-100):
- 0-39: Strong Reject - Critical issues, not investment-ready
- 40-59: Reject or Request More Information - Significant concerns
- 60-79: Deep Dive Required - Promising but needs validation
- 80-100: Recommend to IC - Strong opportunity, ready for investment

Be calibrated. Most startups should score 40-70. Scores above 80 are rare and reserved for exceptional opportunities.`;

export function buildRecommendationUser(data: {
  founderInputs: string;
  criteriaScores: string;
  flags: string;
  researchData: string;
}): string {
  return `Generate a final investment recommendation based on all analysis data.

## Founder Information:
${data.founderInputs}

## 7-Criteria Scores:
${data.criteriaScores}

## Green & Red Flags:
${data.flags}

## Market Research:
${data.researchData}

Return as JSON:
{
  "overall_score": <0-100>,
  "recommendation": "<1-2 sentence investment recommendation>",
  "executive_summary": "<3-5 sentence executive summary of the opportunity>",
  "detailed_rationale": "<500-800 word detailed analysis covering strengths, weaknesses, key risks, potential upside, and final reasoning for the score>"
}

Return ONLY valid JSON. No markdown formatting.`;
}

export const RESEARCH_SYSTEM = `You are a market research analyst. Based on the startup information provided, generate a comprehensive market research summary.
Focus on verifiable facts and reasonable estimates. If you are unsure about specific data, note it as an estimate.`;

export function buildResearchUser(startupName: string, sector: string, description: string): string {
  return `Research the following startup's market and competitive landscape:

Startup: ${startupName}
Sector: ${sector}
Description: ${description}

Provide a comprehensive market research analysis as JSON:
{
  "market_size": "<TAM estimate with reasoning>",
  "competitors": ["<competitor 1 with brief description>", "<competitor 2>", ...],
  "trends": ["<relevant market trend 1>", "<trend 2>", ...],
  "sources": ["<data source or reference 1>", "<source 2>", ...],
  "summary": "<2-3 paragraph market research summary covering market dynamics, competitive landscape, and growth potential>"
}

Return ONLY valid JSON. No markdown formatting.`;
}
