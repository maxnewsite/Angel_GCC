"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/ScoreMeter";
import { CriteriaScores } from "@/components/CriteriaScores";
import { FlagsList } from "@/components/FlagsList";
import type { Submission, AnalysisReport } from "@/lib/types";

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
      const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id }),
      });

      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${submission?.startup_name || "report"}_analysis.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to generate PDF. Please try again.");
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
          </p>
        </div>
        <Button onClick={downloadPDF} disabled={downloading}>
          {downloading ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="py-8">
          <ScoreMeter score={report.overall_score} />
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
