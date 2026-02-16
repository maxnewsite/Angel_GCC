export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "founder" | "admin";
  created_at: string;
}

export interface Submission {
  id: string;
  founder_id: string;
  startup_name: string;
  website: string | null;
  sector: string | null;
  hq_location: string | null;
  description: string | null;
  founding_date: string | null;
  team_info: string | null;
  traction_info: string | null;
  business_model: string | null;
  funding_ask: string | null;
  use_of_funds: string | null;
  status: "submitted" | "in_review" | "analyzing" | "completed" | "rejected";
  created_at: string;
  updated_at: string;
  // joined fields
  profiles?: Profile;
  documents?: Document[];
  analysis_reports?: AnalysisReport[];
}

export interface Document {
  id: string;
  submission_id: string;
  file_name: string;
  file_type: "pitch_deck" | "financials" | "other";
  storage_path: string;
  file_size: number | null;
  uploaded_at: string;
}

export interface CriterionScore {
  criterion: string;
  key: string;
  weight: number;
  score: number;
  rationale: string;
}

export interface Flag {
  flag: string;
  category: string;
  evidence: string;
}

export interface MarketResearch {
  market_size: string;
  competitors: string[];
  trends: string[];
  sources: string[];
  summary: string;
}

export interface AnalysisReport {
  id: string;
  submission_id: string;
  overall_score: number;
  recommendation: string;
  executive_summary: string;
  criteria_scores: CriterionScore[];
  green_flags: Flag[];
  red_flags: Flag[];
  market_research: MarketResearch;
  detailed_rationale: string;
  raw_ai_responses: Record<string, unknown>;
  generated_at: string;
}
