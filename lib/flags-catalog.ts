export interface FlagTemplate {
  flag: string;
  category: "Team" | "Traction" | "Market" | "Product" | "Business Model" | "Deal Terms";
  type: "green" | "red";
  description: string;
}

export const YC_FLAGS_CATALOG: FlagTemplate[] = [
  // GREEN FLAGS - Team
  { flag: "Exceptional founding team", category: "Team", type: "green", description: "Founders have deep domain expertise, prior startup experience, or exceptional credentials" },
  { flag: "Strong co-founder dynamics", category: "Team", type: "green", description: "Complementary skills, long working history, clear role division" },
  { flag: "Technical founder", category: "Team", type: "green", description: "At least one founder can build the core product" },
  { flag: "Domain expert founder", category: "Team", type: "green", description: "Founder has lived the problem and understands it deeply" },
  { flag: "Repeat founder", category: "Team", type: "green", description: "Founder has previous startup experience (especially successful exits)" },

  // GREEN FLAGS - Traction
  { flag: "Strong product-market fit", category: "Traction", type: "green", description: "Users love the product, high retention, organic growth" },
  { flag: "Impressive growth metrics", category: "Traction", type: "green", description: "Week-over-week or month-over-month growth exceeding 15-20%" },
  { flag: "Revenue generating", category: "Traction", type: "green", description: "Already making money, even if small amounts" },
  { flag: "High user engagement", category: "Traction", type: "green", description: "Users are active, returning frequently, and spending time on product" },
  { flag: "Organic growth", category: "Traction", type: "green", description: "Growth driven by word-of-mouth rather than paid acquisition" },

  // GREEN FLAGS - Market
  { flag: "Large addressable market", category: "Market", type: "green", description: "TAM exceeds $1B with clear path to capture meaningful share" },
  { flag: "Market timing is right", category: "Market", type: "green", description: "Structural changes make this the right time for this solution" },
  { flag: "Underserved market segment", category: "Market", type: "green", description: "Clear gap in existing solutions for target customers" },

  // GREEN FLAGS - Product
  { flag: "Defensible technology", category: "Product", type: "green", description: "Patent-worthy innovation, proprietary algorithms, or unique data" },
  { flag: "Strong network effects", category: "Product", type: "green", description: "Product gets more valuable as more users join" },
  { flag: "10x better than alternatives", category: "Product", type: "green", description: "Dramatically better experience than existing solutions" },

  // GREEN FLAGS - Business Model
  { flag: "Strong unit economics", category: "Business Model", type: "green", description: "LTV/CAC ratio above 3x, healthy margins" },
  { flag: "Recurring revenue model", category: "Business Model", type: "green", description: "SaaS, subscription, or other predictable revenue streams" },
  { flag: "Capital efficient", category: "Business Model", type: "green", description: "Achieving significant milestones with minimal capital" },

  // GREEN FLAGS - Deal Terms
  { flag: "Reasonable valuation", category: "Deal Terms", type: "green", description: "Valuation aligned with stage, traction, and market" },
  { flag: "Investor-friendly terms", category: "Deal Terms", type: "green", description: "Standard terms without unusual protections or restrictions" },

  // RED FLAGS - Team
  { flag: "Solo non-technical founder", category: "Team", type: "red", description: "Single founder without technical skills building a tech product" },
  { flag: "Founder-market mismatch", category: "Team", type: "red", description: "Founders lack relevant domain experience or understanding" },
  { flag: "Co-founder conflict signs", category: "Team", type: "red", description: "Evidence of disagreement, unclear roles, or recent team changes" },
  { flag: "Part-time founders", category: "Team", type: "red", description: "Founders not fully committed to the venture" },

  // RED FLAGS - Traction
  { flag: "No traction after launch", category: "Traction", type: "red", description: "Product launched but failed to gain meaningful users or revenue" },
  { flag: "Vanity metrics", category: "Traction", type: "red", description: "Reporting downloads/signups without retention or engagement data" },
  { flag: "Declining metrics", category: "Traction", type: "red", description: "Key metrics trending downward" },

  // RED FLAGS - Market
  { flag: "Small or shrinking market", category: "Market", type: "red", description: "TAM below $500M or market is declining" },
  { flag: "Winner-take-all market with incumbent", category: "Market", type: "red", description: "Dominant player exists with strong network effects" },
  { flag: "Heavy regulatory risk", category: "Market", type: "red", description: "Significant regulatory uncertainty that could kill the business" },

  // RED FLAGS - Product
  { flag: "No clear differentiation", category: "Product", type: "red", description: "Product is easily replicated with no meaningful moat" },
  { flag: "Technology risk", category: "Product", type: "red", description: "Core technology is unproven or faces fundamental challenges" },

  // RED FLAGS - Business Model
  { flag: "Poor unit economics", category: "Business Model", type: "red", description: "CAC exceeds LTV, negative margins with no clear path to improvement" },
  { flag: "No clear revenue model", category: "Business Model", type: "red", description: "No plan for monetization or unrealistic revenue assumptions" },
  { flag: "High burn rate", category: "Business Model", type: "red", description: "Spending significantly exceeds revenue with long runway to profitability" },

  // RED FLAGS - Deal Terms
  { flag: "Overvalued for stage", category: "Deal Terms", type: "red", description: "Valuation significantly above comparable deals for the stage" },
  { flag: "Unfavorable cap table", category: "Deal Terms", type: "red", description: "Too many investors, excessive dilution, or complicated structure" },
  { flag: "Non-standard terms", category: "Deal Terms", type: "red", description: "Unusual provisions that could harm investor interests" },
];

export const FLAG_CATEGORIES = ["Team", "Traction", "Market", "Product", "Business Model", "Deal Terms"] as const;
