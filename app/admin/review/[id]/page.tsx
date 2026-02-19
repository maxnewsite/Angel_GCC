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
    setAnalyzeProgress("Starting AI analysis...");

    // Update status to analyzing
    await supabase
      .from("submissions")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", id);

    setSubmission((prev) => prev ? { ...prev, status: "analyzing" } : prev);

    try {
      setAnalyzeProgress("AI is analyzing the submission... This may take 1-2 minutes.");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis failed");
      }

      setAnalyzeProgress("Analysis complete! Redirecting to report...");
      setTimeout(() => {
        router.push(`/admin/report/${id}`);
      }, 1500);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      // Revert status
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
      <Card className={`border-2 ${submission.status === "rejected" ? "border-red-300 bg-red-50/30" : "border-blue-300"}`}>
        <CardHeader>
          <h3 className={`text-lg font-semibold ${submission.status === "rejected" ? "text-red-700" : "text-blue-700"}`}>
            AI Analysis
          </h3>
        </CardHeader>
        <CardContent>
          {submission.status === "completed" ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium mb-3">Analysis already completed.</p>
              <Button onClick={() => router.push(`/admin/report/${id}`)}>
                View Report
              </Button>
            </div>
          ) : submission.status === "rejected" ? (
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
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-4" />
              <p className="text-blue-600 font-medium">{analyzeProgress}</p>
              <p className="text-xs text-slate-400 mt-2">
                The AI is analyzing the pitch deck, conducting market research, scoring 7 criteria, and detecting flags...
              </p>
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
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-6">
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
