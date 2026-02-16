"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

type AnalystAnalysis = {
  analyst_id: string;
  analyst_name: string;
  analyst_email: string;
  overall_score: number;
  decision: string;
  summary_memo: string;
  created_at: string;
  updated_at: string;
  scores?: any[];
  flags?: {
    green_flags: any[];
    red_flags: any[];
  };
};

export function AnalystAnalysesView({ dealId }: { dealId: string }) {
  const [analyses, setAnalyses] = useState<AnalystAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnalyst, setExpandedAnalyst] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, [dealId]);

  async function loadAnalyses() {
    try {
      // Fetch analyst reviews
      const { data: reviews } = await supabase
        .from("analyst_screening_reviews")
        .select(`
          id,
          overall_score,
          decision,
          summary_memo,
          created_at,
          updated_at,
          analyst_user_id,
          analyst:analyst_user_id(full_name,email)
        `)
        .eq("deal_id", dealId)
        .order("updated_at", { ascending: false });

      if (!reviews || reviews.length === 0) {
        setAnalyses([]);
        setLoading(false);
        return;
      }

      // For each analyst, fetch their detailed scores and flags
      const analysesWithDetails = await Promise.all(
        reviews.map(async (review: any) => {
          // Fetch scores
          const { data: scores } = await supabase
            .from("analyst_screening_scores")
            .select(`
              score,
              note,
              criterion:criterion_id(name,description,weight)
            `)
            .eq("deal_id", dealId)
            .eq("analyst_user_id", review.analyst_user_id);

          // Fetch flags
          const { data: flags } = await supabase
            .from("analyst_deal_flags")
            .select("green_flags,red_flags")
            .eq("deal_id", dealId)
            .eq("analyst_user_id", review.analyst_user_id)
            .maybeSingle();

          return {
            analyst_id: review.analyst_user_id,
            analyst_name: review.analyst?.full_name || "Unknown Analyst",
            analyst_email: review.analyst?.email || "",
            overall_score: review.overall_score,
            decision: review.decision,
            summary_memo: review.summary_memo,
            created_at: review.created_at,
            updated_at: review.updated_at,
            scores: scores || [],
            flags: flags || { green_flags: [], red_flags: [] },
          };
        })
      );

      setAnalyses(analysesWithDetails);
    } catch (e) {
      console.error("Failed to load analyst analyses:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-sm text-black/60">Loading analyst analyses...</div>
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">📊 Analyst Analyses</div>
          <div className="text-xs text-black/60">Screening analyses from dealflow analysts</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-black/60">No analyst analyses yet.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">📊 Analyst Analyses ({analyses.length})</div>
        <div className="text-xs text-black/60">
          Screening analyses from dealflow analysts • Click to expand details
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {analyses.map((analysis) => (
            <div
              key={analysis.analyst_id}
              className="rounded-xl border border-black/10 bg-white/70 overflow-hidden backdrop-blur"
            >
              {/* Header - Always visible */}
              <button
                onClick={() =>
                  setExpandedAnalyst(
                    expandedAnalyst === analysis.analyst_id ? null : analysis.analyst_id
                  )
                }
                className="w-full p-4 text-left hover:bg-black/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{analysis.analyst_name}</div>
                      <Badge
                        className={
                          analysis.decision === "recommend"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : analysis.decision === "not_recommend"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }
                      >
                        {analysis.decision.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-black/60 mt-1">{analysis.analyst_email}</div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                      Score: {analysis.overall_score?.toFixed(2) || "—"}
                    </Badge>
                    <div className="text-xs text-black/50 mt-1">
                      {new Date(analysis.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Summary Memo - Always visible */}
                {analysis.summary_memo && (
                  <div className="mt-3 pt-3 border-t border-black/10">
                    <div className="text-xs font-semibold text-black/70 mb-1">Executive Summary</div>
                    <div className="text-sm text-black/70 line-clamp-3">
                      {analysis.summary_memo}
                    </div>
                  </div>
                )}

                {/* Expand indicator */}
                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                  {expandedAnalyst === analysis.analyst_id ? "▼" : "▶"} Click to{" "}
                  {expandedAnalyst === analysis.analyst_id ? "collapse" : "expand"} details
                </div>
              </button>

              {/* Detailed Analysis - Expandable */}
              {expandedAnalyst === analysis.analyst_id && (
                <div className="border-t border-black/10 p-4 space-y-4 bg-white/50">
                  {/* Full Summary Memo */}
                  {analysis.summary_memo && (
                    <div className="rounded-xl border border-black/10 bg-gradient-to-br from-blue-50/50 to-purple-50/50 p-3">
                      <div className="text-xs font-semibold text-black/70 mb-2">
                        📝 Full Executive Summary
                      </div>
                      <div className="text-sm text-black/80 whitespace-pre-wrap leading-relaxed">
                        {analysis.summary_memo}
                      </div>
                    </div>
                  )}

                  {/* Criteria Scores */}
                  {analysis.scores && analysis.scores.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-black/70 mb-2">
                        📈 Detailed Criteria Scores
                      </div>
                      <div className="space-y-2">
                        {analysis.scores.map((score: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-black/10 bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium">
                                  {score.criterion?.name || "Criterion"}
                                </div>
                                {score.criterion?.description && (
                                  <div className="text-xs text-black/60 mt-0.5">
                                    {score.criterion.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-black/50">
                                  Weight: {score.criterion?.weight || 1}
                                </div>
                                <Badge
                                  className={`${
                                    score.score >= 4
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : score.score >= 3
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                                  }`}
                                >
                                  {score.score}/5
                                </Badge>
                              </div>
                            </div>
                            {score.note && (
                              <div className="text-sm text-black/70 mt-2 pl-3 border-l-2 border-black/10">
                                {score.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Green Flags */}
                  {analysis.flags?.green_flags && analysis.flags.green_flags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-black/70 mb-2">
                        🟢 Green Flags ({analysis.flags.green_flags.length})
                      </div>
                      <div className="space-y-2">
                        {analysis.flags.green_flags.map((flag: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-green-200 bg-green-50/50 p-2"
                          >
                            <div className="text-sm font-medium text-green-900">{flag.flag}</div>
                            {flag.note && (
                              <div className="text-xs text-green-700/80 mt-1">{flag.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Red Flags */}
                  {analysis.flags?.red_flags && analysis.flags.red_flags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-black/70 mb-2">
                        🔴 Red Flags ({analysis.flags.red_flags.length})
                      </div>
                      <div className="space-y-2">
                        {analysis.flags.red_flags.map((flag: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-red-200 bg-red-50/50 p-2"
                          >
                            <div className="text-sm font-medium text-red-900">{flag.flag}</div>
                            {flag.note && (
                              <div className="text-xs text-red-700/80 mt-1">{flag.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-black/50 pt-3 border-t border-black/10">
                    <div>
                      Created: <span className="font-medium text-black/70">
                        {new Date(analysis.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      Last Updated: <span className="font-medium text-black/70">
                        {new Date(analysis.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
