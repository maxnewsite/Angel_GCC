"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication and real-time data
export const dynamic = 'force-dynamic';
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Submission, Document } from "@/lib/types";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [analyzeTotal, setAnalyzeTotal] = useState(6);
  const [selectedModel, setSelectedModel] = useState("claude-haiku-4-5-20251001");
  const [extractionStats, setExtractionStats] = useState<{ fieldsTotal: number; fieldsPopulated: number; wordCount: number } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sub } = await supabase
        .from("submissions")
        .select("*, profiles(email, full_name)")
        .eq("id", id)
        .single();

      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("submission_id", id)
        .order("uploaded_at");

      setSubmission(sub as Submission);
      setDocuments((docs as Document[]) || []);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function downloadDoc(doc: Document) {
    const { data } = await supabase.storage.from("submissions").download(doc.storage_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function rejectSubmission() {
    setRejecting(true);
    setRejectError("");
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setSubmission((prev) => prev ? { ...prev, status: "rejected" } : prev);
      setShowRejectConfirm(false);
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : "Failed to reject submission");
    } finally {
      setRejecting(false);
    }
  }

  async function authorizeAnalysis() {
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalyzeStep(0);
    setAnalyzeProgress("Starting AI analysis...");
    setExtractionStats(null);

    await supabase
      .from("submissions")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", id);
    setSubmission((prev) => prev ? { ...prev, status: "analyzing" } : prev);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id, model: selectedModel }),
      });

      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as {
            step?: number;
            total?: number;
            message?: string;
            done?: boolean;
            error?: string;
            extractionStats?: { fieldsTotal: number; fieldsPopulated: number; wordCount: number };
          };

          if (data.error) throw new Error(data.error);
          if (data.step !== undefined) setAnalyzeStep(data.step);
          if (data.total !== undefined) setAnalyzeTotal(data.total);
          if (data.message) setAnalyzeProgress(data.message);
          if (data.extractionStats) setExtractionStats(data.extractionStats);

          if (data.done) {
            setTimeout(() => router.push(`/admin/report/${id}`), 1200);
          }
        }
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      await supabase
        .from("submissions")
        .update({ status: "in_review", updated_at: new Date().toISOString() })
        .eq("id", id);
      setSubmission((prev) => prev ? { ...prev, status: "in_review" } : prev);
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }

  if (!submission) {
    return <div className="text-center py-12 text-red-500">Submission not found</div>;
  }

  const founderProfile = submission.profiles as unknown as { email: string; full_name: string | null };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push("/admin/dashboard")} className="mb-2">
            &larr; Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold text-slate-900">{submission.startup_name}</h2>
          <div className="text-sm text-slate-500">
            <p>
              Submitted by {founderProfile?.full_name || "Unknown"}
              {founderProfile?.full_name && " "}
              <span className="text-blue-600 font-medium">({founderProfile?.email})</span>
            </p>
            <p className="mt-1">
              Submission date: {new Date(submission.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge
          variant={
            submission.status === "completed"
              ? "success"
              : submission.status === "rejected"
              ? "destructive"
              : submission.status === "analyzing"
              ? "default"
              : "secondary"
          }
        >
          {submission.status === "rejected" ? "Rejected" : submission.status}
        </Badge>
      </div>

      {/* Initial Form Data - Quality Assessment */}
      <Card className="border-2 border-purple-200 bg-purple-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-900">📝 Initial Form Submission - Quality Assessment</h3>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              Founder-Provided Information
            </Badge>
          </div>
          <p className="text-xs text-purple-700 mt-1">
            Review the quality and completeness of the information provided by the founder in their initial application form.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Sector" value={submission.sector} />
              <InfoItem label="Location" value={submission.hq_location} />
              <InfoItem label="Website" value={submission.website} />
              <InfoItem label="Founded" value={submission.founding_date} />
            </div>
            {submission.description && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-500 uppercase">Company Description</label>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                  {submission.description}
                </p>
              </div>
            )}
          </div>

          {/* Team */}
          {submission.team_info && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Team Background</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                {submission.team_info}
              </p>
            </div>
          )}

          {/* Traction */}
          {submission.traction_info && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Traction & Metrics</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                {submission.traction_info}
              </p>
            </div>
          )}

          {/* Business Model */}
          {submission.business_model && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Business Model</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                {submission.business_model}
              </p>
            </div>
          )}

          {/* Funding */}
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Funding Details</h4>
            {submission.funding_ask && (
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase">Funding Ask</label>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                  {submission.funding_ask}
                </p>
              </div>
            )}
            {submission.use_of_funds && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Use of Funds</label>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-200">
                  {submission.use_of_funds}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Uploaded Documents ({documents.length})</h3>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-blue-100 p-3"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700">{doc.file_name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      ({doc.file_type}) {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => downloadDoc(doc)}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Authorization */}
      <Card className={`border-2 ${
        submission.status === "rejected"
          ? "border-red-300 bg-red-50/30"
          : submission.status === "completed"
          ? "border-green-300 bg-green-50/20"
          : "border-blue-300"
      }`}>
        <CardHeader>
          <h3 className={`text-lg font-semibold ${
            submission.status === "rejected"
              ? "text-red-700"
              : submission.status === "completed"
              ? "text-green-700"
              : "text-blue-700"
          }`}>
            AI Analysis
          </h3>
        </CardHeader>
        <CardContent>
          {submission.status === "rejected" ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
                <span className="text-2xl">✕</span>
              </div>
              <p className="text-red-700 font-semibold text-lg mb-1">Application Rejected</p>
              <p className="text-sm text-slate-500 mb-4">
                This submission has been moved to the rejected bucket.
              </p>
              {submission.rejection_reason && (
                <div className="rounded-lg bg-white border border-red-200 px-4 py-3 text-sm text-slate-700 mb-4 text-left max-w-md mx-auto">
                  <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Rejection Reason</span>
                  {submission.rejection_reason}
                </div>
              )}
              <Button
                variant="ghost"
                className="text-slate-500 text-sm"
                onClick={async () => {
                  await supabase
                    .from("submissions")
                    .update({ status: "in_review", rejection_reason: null, updated_at: new Date().toISOString() })
                    .eq("id", id);
                  setSubmission((prev) => prev ? { ...prev, status: "in_review" } : prev);
                }}
              >
                Undo Rejection
              </Button>
            </div>
          ) : analyzing ? (
            <div className="py-6">
              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-700">{analyzeProgress}</span>
                  <span className="text-xs text-slate-400">
                    {analyzeStep > 0 ? `${analyzeStep} / ${analyzeTotal}` : ""}
                  </span>
                </div>
                <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all duration-700 ease-out"
                    style={{ width: analyzeTotal > 0 ? `${Math.round((analyzeStep / analyzeTotal) * 100)}%` : "4%" }}
                  />
                </div>
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {[
                  "Extracting pitch deck data",
                  "Conducting market research",
                  "Scoring 7 investment criteria",
                  "Detecting YC-style green & red flags",
                  "Generating investment recommendation",
                  "Saving analysis report",
                ].map((label, i) => {
                  const stepNum = i + 1;
                  const isDone = analyzeStep > stepNum;
                  const isActive = analyzeStep === stepNum;
                  const showStats = stepNum === 1 && extractionStats !== null && (isDone || isActive);
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 text-sm rounded-lg px-3 py-2 transition-colors ${
                        isDone
                          ? "text-green-700 bg-green-50"
                          : isActive
                          ? "text-blue-700 bg-blue-50"
                          : "text-slate-400"
                      }`}
                    >
                      <span className="w-5 text-center shrink-0 mt-0.5">
                        {isDone ? "✓" : isActive ? (
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
                        ) : "○"}
                      </span>
                      <div>
                        <span>{label}</span>
                        {showStats && (
                          <p className={`text-xs mt-0.5 ${isDone ? "text-green-600" : "text-blue-500"}`}>
                            {extractionStats.fieldsTotal > 0
                              ? `${extractionStats.fieldsPopulated}/${extractionStats.fieldsTotal} fields · ~${extractionStats.wordCount} words`
                              : `~${extractionStats.wordCount} words extracted`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : showRejectConfirm ? (
            <div className="py-4 space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">Reject this application?</p>
                <p className="text-xs text-red-600 mb-3">
                  The submission will be moved to the <strong>rejected</strong> bucket and no AI analysis will be run.
                </p>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">
                  Reason for rejection <span className="font-normal normal-case text-slate-400">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  rows={3}
                  placeholder="e.g. Outside investment thesis, insufficient traction, duplicate submission..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                {rejectError && (
                  <p className="text-xs text-red-600 mt-2">{rejectError}</p>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="ghost"
                  onClick={() => { setShowRejectConfirm(false); setRejectReason(""); setRejectError(""); }}
                  disabled={rejecting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={rejectSubmission}
                  disabled={rejecting}
                  className="bg-red-600 hover:bg-red-700 text-white px-6"
                >
                  {rejecting ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {/* Model selector */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">
                  AI Model
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", desc: "Fast · Economical" },
                    { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", desc: "Balanced · Recommended" },
                    { id: "claude-opus-4-6",           label: "Opus 4.6",  desc: "Most Capable · Slower" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                        selectedModel === m.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${selectedModel === m.id ? "text-blue-700" : "text-slate-700"}`}>
                        {m.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {submission.status === "completed" ? (
                /* Re-run section for completed analyses */
                <div>
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Analysis completed.</p>
                      <p className="text-xs text-green-700 mt-0.5">You can view the existing report or re-run with a different model.</p>
                    </div>
                    <Button onClick={() => router.push(`/admin/report/${id}`)} className="shrink-0 ml-4">
                      View Report
                    </Button>
                  </div>
                  {analyzeError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                      {analyzeError}
                    </div>
                  )}
                  <div className="text-center">
                    <Button
                      onClick={authorizeAnalysis}
                      className="px-8 bg-amber-600 hover:bg-amber-700"
                    >
                      Re-run AI Analysis
                    </Button>
                  </div>
                </div>
              ) : (
                /* Initial run section */
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-4">
                    Authorize the AI to perform a comprehensive analysis including 7-criteria scoring,
                    YC-style flag detection, market research, and generate a full investment report.
                  </p>
                  {analyzeError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                      {analyzeError}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={authorizeAnalysis} className="px-8">
                      Authorize AI Analysis
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-6 text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200"
                      onClick={() => setShowRejectConfirm(true)}
                    >
                      Reject Application
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
      <p className="text-sm text-slate-700">{value || "-"}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
