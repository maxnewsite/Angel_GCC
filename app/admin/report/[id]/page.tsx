"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication and real-time data
export const dynamic = 'force-dynamic';
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/ScoreMeter";
import { CriteriaScores } from "@/components/CriteriaScores";
import { FlagsList } from "@/components/FlagsList";
import type { Submission, AnalysisReport } from "@/lib/types";
import { authFetch } from "@/lib/api-client";
import { MODELS } from "@/lib/models";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sub } = await supabase
        .from("submissions")
        .select("*, profiles(email, full_name)")
        .eq("id", id)
        .single();

      const { data: rep } = await supabase
        .from("analysis_reports")
        .select("*")
        .eq("submission_id", id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      setSubmission(sub as Submission);
      setReport(rep as AnalysisReport);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function downloadPDF() {
    setDownloading(true);
    try {
      const response = await authFetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "PDF generation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${submission?.startup_name || "report"}_analysis.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.");
    }
    setDownloading(false);
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading report...</div>;
  }

  if (!submission || !report) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Report not found. The analysis may not be complete yet.</p>
        <Button variant="secondary" onClick={() => router.push("/admin/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const insights = report.insights ?? {};
  const modelName = MODELS.find((m) => m.id === insights.model)?.name ?? insights.model;
  const takeaways = [
    { title: "Key Strengths", items: insights.key_strengths, color: "text-green-700", dot: "bg-green-500" },
    { title: "Key Risks", items: insights.key_risks, color: "text-red-700", dot: "bg-red-500" },
    { title: "Due Diligence Questions", items: insights.due_diligence_questions, color: "text-blue-700", dot: "bg-blue-500" },
    { title: "Missing From the Deck", items: insights.missing_information, color: "text-slate-700", dot: "bg-slate-400" },
  ].filter((t) => (t.items ?? []).length > 0);

  const marketResearch = report.market_research as {
    market_size?: string;
    competitors?: string[];
    trends?: string[];
    summary?: string;
    sources?: string[];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push("/admin/dashboard")} className="mb-2">
            &larr; Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold text-slate-900">
            Analysis Report: {submission.startup_name}
          </h2>
          <p className="text-sm text-slate-500">
            Generated on {new Date(report.generated_at).toLocaleString()}
            {modelName ? ` · ${modelName}` : ""}
          </p>
          {insights.deck?.one_liner && (
            <p className="text-sm text-slate-700 mt-1">{insights.deck.one_liner}</p>
          )}
        </div>
        <Button onClick={downloadPDF} disabled={downloading}>
          {downloading ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>

      {(insights.warnings ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">Parts of this analysis did not complete — consider re-running it:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {insights.warnings!.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Overall Score */}
      <Card>
        <CardContent className="py-8">
          <ScoreMeter score={report.overall_score} />
          {insights.weighted_score !== undefined && !!insights.score_adjustment && (
            <p className="text-xs text-slate-500 text-center mt-3">
              Weighted criteria score {insights.weighted_score}, analyst adjustment{" "}
              {insights.score_adjustment > 0 ? "+" : ""}{insights.score_adjustment}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recommendation</h3>
        </CardHeader>
        <CardContent>
          <p className="text-base font-medium text-slate-900 mb-3">{report.recommendation}</p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{report.executive_summary}</p>
        </CardContent>
      </Card>

      {/* Key takeaways */}
      {takeaways.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Key Takeaways</h3>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {takeaways.map((t) => (
              <div key={t.title}>
                <p className={`text-xs font-semibold uppercase mb-2 ${t.color}`}>{t.title}</p>
                <ul className="space-y-1.5">
                  {t.items!.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.dot}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 7 Criteria Breakdown */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">7-Criteria Screening Analysis</h3>
        </CardHeader>
        <CardContent>
          <CriteriaScores scores={report.criteria_scores} />
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">YC-Style Investment Flags</h3>
        </CardHeader>
        <CardContent>
          <FlagsList greenFlags={report.green_flags} redFlags={report.red_flags} />
        </CardContent>
      </Card>

      {/* Market Research */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Market Research</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {marketResearch.market_size && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Market Size</label>
              <p className="text-sm text-slate-700 mt-1">{marketResearch.market_size}</p>
            </div>
          )}
          {marketResearch.competitors && marketResearch.competitors.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Competitors</label>
              <ul className="list-disc list-inside text-sm text-slate-700 mt-1">
                {marketResearch.competitors.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {marketResearch.trends && marketResearch.trends.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Market Trends</label>
              <ul className="list-disc list-inside text-sm text-slate-700 mt-1">
                {marketResearch.trends.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {marketResearch.summary && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Research Summary</label>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{marketResearch.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Rationale */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Detailed Analysis</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {report.detailed_rationale}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
