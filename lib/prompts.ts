import { SCREENING_CRITERIA } from "./criteria";
import { YC_FLAGS_CATALOG } from "./flags-catalog";

const criteriaText = SCREENING_CRITERIA.map(
  (c, i) =>
    `${i + 1}. ${c.name} — key "${c.key}" (weight ${c.weight})\n   ${c.description}\n${Object.entries(c.scoring_guide)
      .map(([k, v]) => `   ${k}/5: ${v}`)
      .join("\n")}`
).join("\n\n");

const greenFlagsText = YC_FLAGS_CATALOG.filter((f) => f.type === "green")
  .map((f) => `- [${f.category}] ${f.flag}: ${f.description}`)
  .join("\n");

const redFlagsText = YC_FLAGS_CATALOG.filter((f) => f.type === "red")
  .map((f) => `- [${f.category}] ${f.flag}: ${f.description}`)
  .join("\n");

const EVIDENCE_RULES = `Ground every statement in the materials provided. Founder-provided information and pitch deck content are claims made by the company, not verified facts — say "the deck claims" where it matters. Information marked "Not provided" is missing: treat missing evidence as a weakness for that area and never invent numbers, names or facts to fill the gap.`;

/** Formats all known company information into tagged sections. */
export function buildCompanyContext(data: {
  founderInputs: string;
  extraction: string;
  research?: string;
}): string {
  return [
    `<founder_provided>\n${data.founderInputs || "No founder-provided form data (pitch uploaded for screening)."}\n</founder_provided>`,
    `<pitch_deck_extraction>\n${data.extraction}\n</pitch_deck_extraction>`,
    data.research ? `<market_research>\n${data.research}\n</market_research>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Step 1: pitch deck extraction ─────────────────────────────────────────

export const PITCH_DECK_EXTRACTION_SYSTEM = `You are a startup analyst at an angel investment fund. You extract structured, factual information from pitch decks so investors can screen them quickly.
Read every slide, including numbers shown in charts, tables and images. Be specific: keep figures, dates, names and units exactly as shown. When the deck does not cover a field, write "Not provided".`;

export const PITCH_DECK_EXTRACTION_USER = `Extract the key investment information from this pitch deck. List in missing_information the things an angel investor would expect but the deck does not provide (for example revenue figures, team backgrounds, valuation).`;

// ── Step 2: market research ───────────────────────────────────────────────

export const RESEARCH_SYSTEM = `You are a market research analyst supporting early-stage investment screening. You do not have live web access, so work from your own knowledge of markets and companies.
Give concrete estimates with the reasoning behind them and label them as estimates. Name real competitors you are confident exist; do not invent companies or statistics.`;

export function buildResearchUser(company: string): string {
  return `Assess the market and competitive landscape for this startup.

${company}

Cover market size, the most relevant competitors and substitutes, trends that help or hurt the company, and an overall view of the market opportunity. Where the deck's market claims look inflated or unsupported, say so.`;
}

// ── Step 3: criteria scoring ──────────────────────────────────────────────

export const SEVEN_CRITERIA_SYSTEM = `You are a senior angel investor with 20 years of experience screening early-stage startups. You score each startup on 7 criteria from 1 to 5 using the scoring guide below.

Be rigorous and calibrated: a typical early-stage pitch scores mostly 2-3; a 5 needs strong, specific evidence. ${EVIDENCE_RULES}
Set confidence to "low" when a score rests on little or no evidence.

THE 7 SCREENING CRITERIA:

${criteriaText}`;

export function buildSevenCriteriaUser(company: string): string {
  return `Score this startup on all 7 criteria, returning exactly one entry per criterion key.

${company}`;
}

// ── Step 4: flags ─────────────────────────────────────────────────────────

export const YC_FLAGS_SYSTEM = `You are a YC-trained startup evaluator. You identify green flags (strengths) and red flags (concerns) for investment screening.

Use this reference list, and add other flags when the evidence supports them:

GREEN FLAGS:
${greenFlagsText}

RED FLAGS:
${redFlagsText}

${EVIDENCE_RULES} Only raise a flag when you can cite supporting evidence; significant gaps in the materials (e.g. no team information, no traction data) are themselves red flags.`;

export function buildYCFlagsUser(company: string): string {
  return `Identify the green and red flags for this startup.

${company}`;
}

// ── Step 5: recommendation ────────────────────────────────────────────────

export const RECOMMENDATION_SYSTEM = `You are a senior angel investor writing the final screening memo for an investment committee.

The overall score (0-100) is the weighted average of the 7 criteria scores, which you receive already computed. You may adjust it by -10 to +10 when the flags or overall picture justify it (for example a critical red flag the criteria understate); explain any adjustment in the rationale.

Score bands:
- 0-39: Reject — critical issues, not investment-ready
- 40-59: Request more information — significant concerns or gaps
- 60-79: Deep dive — promising, needs validation
- 80-100: Recommend to IC — rare, exceptional opportunity

${EVIDENCE_RULES} Write for busy investors: direct, specific, no filler.`;

export function buildRecommendationUser(data: {
  company: string;
  criteriaScores: string;
  weightedScore: number;
  flags: string;
}): string {
  return `Write the final screening recommendation.

${data.company}

<criteria_scores weighted_score="${data.weightedScore}">
${data.criteriaScores}
</criteria_scores>

<flags>
${data.flags}
</flags>`;
}
