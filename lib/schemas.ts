// JSON schemas for Claude structured outputs (output_config.format).
// Structured outputs require every object to set additionalProperties: false
// and list all of its properties as required.

import { SCREENING_CRITERIA } from "./criteria";
import type { JSONSchema } from "./anthropic";

const str = (description: string) => ({ type: "string", description });
const strList = (description: string) => ({ type: "array", items: { type: "string" }, description });

function object(properties: Record<string, unknown>): JSONSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const FLAG_CATEGORIES = ["Team", "Traction", "Market", "Product", "Business Model", "Deal Terms"];

export interface DeckExtraction {
  startup_name: string;
  website: string;
  sector: string;
  hq_location: string;
  stage: string;
  one_liner: string;
  problem: string;
  solution: string;
  team: string;
  traction: string;
  market: string;
  business_model: string;
  competition: string;
  financials: string;
  funding_ask: string;
  use_of_funds: string;
  notable_claims: string;
  missing_information: string[];
}

export const EXTRACTION_SCHEMA = object({
  startup_name: str("Company name as written in the deck"),
  website: str("Website URL, or 'Not provided'"),
  sector: str("Primary sector, e.g. SaaS, Fintech, Healthtech, Climate/Clean Tech"),
  hq_location: str("City and country of headquarters, or 'Not provided'"),
  stage: str("Company stage, e.g. Idea, Pre-seed, Seed, Series A"),
  one_liner: str("One-sentence description of what the company does"),
  problem: str("Problem being solved and who has it"),
  solution: str("Product/solution and how it works"),
  team: str("Founders and key team: names, roles, relevant background, team size"),
  traction: str("Users, customers, revenue, growth rates, pilots, LOIs — with numbers and dates"),
  market: str("Target market and any TAM/SAM/SOM figures claimed"),
  business_model: str("How they make money: pricing, revenue streams, unit economics"),
  competition: str("Competitors named and the differentiation claimed"),
  financials: str("Revenue, burn, runway, projections"),
  funding_ask: str("Amount raising, instrument, valuation or cap"),
  use_of_funds: str("Planned use of the investment"),
  notable_claims: str("Awards, partnerships, IP, press or other notable claims"),
  missing_information: strList("Important investor information the deck does not provide"),
});

export interface MarketResearch {
  market_size: string;
  competitors: string[];
  trends: string[];
  sources: string[];
  summary: string;
}

export const RESEARCH_SCHEMA = object({
  market_size: str("TAM estimate with the reasoning behind it, labelled as an estimate"),
  competitors: strList("Relevant competitors or substitutes, each with a short description"),
  trends: strList("Market trends that help or hurt this company"),
  sources: strList("Types of sources or reports an analyst should use to verify these figures"),
  summary: str("2-3 paragraph summary of market dynamics, competition and growth potential"),
});

export interface CriterionResult {
  key: string;
  score: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
}

export const CRITERIA_SCHEMA = object({
  scores: {
    type: "array",
    items: object({
      key: { type: "string", enum: SCREENING_CRITERIA.map((c) => c.key) },
      score: { type: "integer", enum: [1, 2, 3, 4, 5] },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How well the available evidence supports this score",
      },
      rationale: str("2-4 sentences citing the specific evidence behind the score"),
    }),
  },
});

export interface FlagResult {
  flag: string;
  category: string;
  evidence: string;
}

const flagItem = object({
  flag: str("Short flag name"),
  category: { type: "string", enum: FLAG_CATEGORIES },
  evidence: str("Specific evidence from the materials"),
});

export const FLAGS_SCHEMA = object({
  green_flags: { type: "array", items: flagItem },
  red_flags: { type: "array", items: flagItem },
});

export interface RecommendationResult {
  score_adjustment: number;
  recommendation: string;
  executive_summary: string;
  key_strengths: string[];
  key_risks: string[];
  due_diligence_questions: string[];
  detailed_rationale: string;
}

export const RECOMMENDATION_SCHEMA = object({
  score_adjustment: {
    type: "integer",
    description: "Adjustment to the weighted criteria score, between -10 and 10",
  },
  recommendation: str("1-2 sentence investment recommendation"),
  executive_summary: str("3-5 sentence summary of the opportunity"),
  key_strengths: strList("3-5 most important strengths"),
  key_risks: strList("3-5 most important risks"),
  due_diligence_questions: strList("3-6 questions to ask the founders next"),
  detailed_rationale: str("500-800 word analysis: strengths, weaknesses, key risks, upside, and reasoning for the score"),
});
