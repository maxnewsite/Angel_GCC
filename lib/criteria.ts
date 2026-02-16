export interface Criterion {
  key: string;
  name: string;
  weight: number;
  description: string;
  scoring_guide: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
}

export const SCREENING_CRITERIA: Criterion[] = [
  {
    key: "market_opportunity",
    name: "Market Opportunity",
    weight: 1.5,
    description: "Total addressable market size, growth rate, timing, and market dynamics",
    scoring_guide: {
      1: "Tiny or shrinking market (<$100M TAM), no clear growth trajectory",
      2: "Small market ($100M-$500M TAM) with limited growth potential",
      3: "Moderate market ($500M-$1B TAM) with steady growth",
      4: "Large market ($1B-$10B TAM) with strong growth trends",
      5: "Massive market (>$10B TAM) with explosive growth and perfect timing",
    },
  },
  {
    key: "team_quality",
    name: "Team Quality",
    weight: 1.5,
    description: "Founder experience, domain expertise, team complementarity, and execution capability",
    scoring_guide: {
      1: "No relevant experience, solo founder with gaps, no domain expertise",
      2: "Limited experience, incomplete team, some domain knowledge",
      3: "Decent experience, reasonable team composition, adequate expertise",
      4: "Strong experience, complementary team, deep domain expertise",
      5: "Exceptional founders with proven track records, world-class team, unfair advantage",
    },
  },
  {
    key: "traction",
    name: "Traction",
    weight: 1.3,
    description: "User growth, revenue, engagement metrics, and product-market fit indicators",
    scoring_guide: {
      1: "No product, no users, just an idea",
      2: "MVP built, <100 users, no revenue",
      3: "Working product, growing user base, early revenue or strong engagement",
      4: "Strong growth metrics (>20% MoM), meaningful revenue, clear PMF signals",
      5: "Exceptional growth (>50% MoM), significant revenue, undeniable PMF",
    },
  },
  {
    key: "business_model",
    name: "Business Model",
    weight: 1.2,
    description: "Revenue model, unit economics, margins, scalability, and path to profitability",
    scoring_guide: {
      1: "No clear revenue model, unsustainable economics",
      2: "Revenue model identified but unproven, unclear unit economics",
      3: "Reasonable revenue model, acceptable unit economics, path to profitability visible",
      4: "Strong revenue model, good unit economics (LTV/CAC > 3x), scalable",
      5: "Exceptional unit economics, multiple revenue streams, highly scalable with clear profitability",
    },
  },
  {
    key: "defensibility",
    name: "Defensibility",
    weight: 1.0,
    description: "Intellectual property, network effects, switching costs, and competitive moat",
    scoring_guide: {
      1: "No defensibility, easily replicated, no barriers to entry",
      2: "Minor first-mover advantage, limited IP or differentiation",
      3: "Some defensibility through technology, brand, or early network effects",
      4: "Strong moat via patents, network effects, data advantage, or high switching costs",
      5: "Exceptional defensibility with multiple compounding moats",
    },
  },
  {
    key: "execution_risk",
    name: "Execution Risk",
    weight: 1.0,
    description: "Technical complexity, go-to-market risk, regulatory exposure, and operational challenges",
    scoring_guide: {
      1: "Extremely high risk: unproven tech, regulatory minefield, impossible GTM",
      2: "High risk: significant technical or market uncertainties",
      3: "Moderate risk: manageable challenges with clear mitigation strategies",
      4: "Low risk: proven tech stack, clear GTM, manageable regulatory environment",
      5: "Very low risk: straightforward execution with proven playbook",
    },
  },
  {
    key: "valuation_fairness",
    name: "Valuation Fairness",
    weight: 0.8,
    description: "Valuation relative to stage, traction, market, and comparable deals",
    scoring_guide: {
      1: "Extremely overvalued relative to stage and traction (>5x above comps)",
      2: "Somewhat overvalued, aggressive terms for the stage",
      3: "Fair valuation aligned with stage and market conditions",
      4: "Attractive valuation with favorable terms for investors",
      5: "Exceptional value - significantly undervalued relative to opportunity",
    },
  },
];

export function computeWeightedScore(scores: { key: string; score: number }[]): number {
  let num = 0;
  let den = 0;
  for (const criterion of SCREENING_CRITERIA) {
    const s = scores.find((sc) => sc.key === criterion.key);
    const score = s?.score ?? 3;
    num += criterion.weight * score;
    den += criterion.weight;
  }
  const avg = den > 0 ? num / den : 3;
  return Math.round((avg / 5) * 100);
}
