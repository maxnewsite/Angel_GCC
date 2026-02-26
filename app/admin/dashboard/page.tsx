"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication and real-time data
export const dynamic = 'force-dynamic';
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Submission } from "@/lib/types";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  in_review: { label: "In Review", variant: "warning" },
  analyzing: { label: "AI Analyzing", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const MODELS = [
  {
    id: "claude-haiku-4-5-20251001",
    name: "Haiku 4.5",
    tagline: "Fast & Efficient",
    description: "Best for quick screening, lower cost",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet 4.6",
    tagline: "Balanced",
    description: "Great balance of quality and speed",
  },
  {
    id: "claude-opus-4-6",
    name: "Opus 4.6",
    tagline: "Most Capable",
    description: "Highest quality, best for key decisions",
  },
];

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<(Submission & { profiles: { email: string; full_name: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>("");

  // Re-run state
  const [rerunId, setRerunId] = useState<string | null>(null);
  const [rerunModel, setRerunModel] = useState("claude-haiku-4-5-20251001");
  const [rerunning, setRerunning] = useState(false);
  const [rerunStep, setRerunStep] = useState(0);
  const [rerunTotal, setRerunTotal] = useState(6);
  const [rerunMessage, setRerunMessage] = useState("");
  const [rerunError, setRerunError] = useState("");
  const [rerunDone, setRerunDone] = useState(false);
  const [rerunExtractionStats, setRerunExtractionStats] = useState<{ fieldsTotal: number; fieldsPopulated: number; wordCount: number } | null>(null);
  const rerunAbortRef = useRef<AbortController | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("submissions")
        .select("*, profiles(email, full_name)")
        .order("created_at", { ascending: false });
      setSubmissions(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError("");

    try {
      const res = await fetch("/api/delete-submission", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }

      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function openRerun(id: string) {
    setRerunId(id);
    setRerunModel("claude-haiku-4-5-20251001");
    setRerunning(false);
    setRerunStep(0);
    setRerunTotal(6);
    setRerunMessage("");
    setRerunError("");
    setRerunDone(false);
  }

  function closeRerun() {
    if (rerunAbortRef.current) {
      rerunAbortRef.current.abort();
      rerunAbortRef.current = null;
    }
    setRerunId(null);
    setRerunning(false);
    setRerunDone(false);
    setRerunError("");
  }

  async function startRerun() {
    if (!rerunId) return;
    setRerunning(true);
    setRerunStep(0);
    setRerunError("");
    setRerunDone(false);
    setRerunMessage("Starting analysis...");
    setRerunExtractionStats(null);

    const abort = new AbortController();
    rerunAbortRef.current = abort;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: rerunId, model: rerunModel }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Analysis request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              setRerunError(payload.error);
              setRerunning(false);
              return;
            }
            if (payload.step) setRerunStep(payload.step);
            if (payload.total) setRerunTotal(payload.total);
            if (payload.message) setRerunMessage(payload.message);
            if (payload.extractionStats) setRerunExtractionStats(payload.extractionStats);
            if (payload.done) {
              setRerunDone(true);
              setRerunning(false);
              // Update local submission status to completed
              setSubmissions((prev) =>
                prev.map((s) => s.id === rerunId ? { ...s, status: "completed" } : s)
              );
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setRerunError(err instanceof Error ? err.message : "Analysis failed");
        setRerunning(false);
      }
    }
  }

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  const rerunSubmission = submissions.find((s) => s.id === rerunId);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="text-sm text-slate-500">Review and manage all startup submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {["all", "submitted", "in_review", "analyzing", "completed"].map((s) => {
          const count = s === "all" ? submissions.length : submissions.filter((sub) => sub.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-xl p-4 text-center transition-all ${
                filter === s
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white border border-blue-100 text-slate-700 hover:shadow-md"
              }`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium capitalize">{s === "all" ? "Total" : s.replace("_", " ")}</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No submissions {filter !== "all" ? `with status "${filter}"` : "yet"}.
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Startup</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Founder</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sector</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Submitted</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const status = STATUS_BADGES[sub.status];
                const isPendingDelete = confirmDeleteId === sub.id;
                const isDeleting = deletingId === sub.id;

                return (
                  <tr
                    key={sub.id}
                    className={`border-b border-blue-50 transition-colors ${
                      isPendingDelete ? "bg-red-50" : "hover:bg-blue-50/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{sub.startup_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {sub.profiles?.full_name && (
                          <div className="font-medium text-slate-900">{sub.profiles.full_name}</div>
                        )}
                        <div className="text-slate-600">{sub.profiles?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{sub.sector || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isPendingDelete ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600 font-medium mr-1">Delete permanently?</span>
                          <Button
                            variant="ghost"
                            onClick={() => { setConfirmDeleteId(null); setDeleteError(""); }}
                            disabled={isDeleting}
                          >
                            Cancel
                          </Button>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            disabled={isDeleting}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {isDeleting ? "Deleting…" : "Confirm Delete"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {sub.status === "completed" ? (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => router.push(`/admin/report/${sub.id}`)}
                              >
                                View Report
                              </Button>
                              <button
                                onClick={() => openRerun(sub.id)}
                                className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                Re-run AI
                              </button>
                            </>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => router.push(`/admin/review/${sub.id}`)}
                            >
                              Review
                            </Button>
                          )}
                          <button
                            onClick={() => { setConfirmDeleteId(sub.id); setDeleteError(""); }}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {deleteError && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-200 text-sm text-red-700">
              {deleteError}
            </div>
          )}
        </div>
      )}

      {/* Re-run AI Analysis Modal */}
      {rerunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50">
              <h3 className="text-lg font-bold text-slate-900">Re-run AI Analysis</h3>
              {rerunSubmission && (
                <p className="text-sm text-slate-500">{rerunSubmission.startup_name}</p>
              )}
            </div>

            <div className="px-6 py-5">
              {rerunDone ? (
                /* Success state */
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-slate-900">Analysis Complete</p>
                  <p className="text-sm text-slate-500 mt-1">The report has been updated successfully.</p>
                  <div className="mt-5 flex gap-3 justify-center">
                    <button
                      onClick={() => { closeRerun(); router.push(`/admin/report/${rerunId}`); }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      View Report
                    </button>
                    <button
                      onClick={closeRerun}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : rerunning ? (
                /* Progress state */
                <div className="py-2">
                  <p className="text-sm font-medium text-slate-700 mb-3">{rerunMessage}</p>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${rerunTotal > 0 ? (rerunStep / rerunTotal) * 100 : 0}%` }}
                    />
                  </div>
                  {/* Step indicators */}
                  <div className="space-y-1.5">
                    {[
                      "Extracting pitch deck data",
                      "Conducting market research",
                      "Scoring 7 investment criteria",
                      "Detecting green & red flags",
                      "Generating recommendation",
                      "Saving analysis report",
                    ].map((label, i) => {
                      const stepNum = i + 1;
                      const isDone = rerunStep > stepNum;
                      const isActive = rerunStep === stepNum;
                      const showStats = stepNum === 1 && rerunExtractionStats !== null && (isDone || isActive);
                      return (
                        <div key={stepNum} className="flex items-start gap-2.5 text-sm">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors mt-0.5 ${
                            isDone ? "bg-green-500 text-white" : isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                          }`}>
                            {isDone ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : stepNum}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={isDone ? "text-green-700" : isActive ? "text-blue-700 font-medium" : "text-slate-400"}>
                                {label}
                              </span>
                              {isActive && (
                                <div className="flex gap-0.5 ml-auto">
                                  {[0, 1, 2].map((d) => (
                                    <div
                                      key={d}
                                      className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                                      style={{ animationDelay: `${d * 0.15}s` }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            {showStats && (
                              <p className={`text-xs mt-0.5 ${isDone ? "text-green-600" : "text-blue-500"}`}>
                                {rerunExtractionStats.fieldsTotal > 0
                                  ? `${rerunExtractionStats.fieldsPopulated}/${rerunExtractionStats.fieldsTotal} fields · ~${rerunExtractionStats.wordCount} words`
                                  : `~${rerunExtractionStats.wordCount} words extracted`}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">This may take a minute or two…</p>
                </div>
              ) : (
                /* Model selection state */
                <>
                  <p className="text-sm text-slate-600 mb-4">Select the Anthropic model to use for this analysis:</p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {MODELS.map((m) => {
                      const selected = rerunModel === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setRerunModel(m.id)}
                          className={`rounded-xl border-2 p-3 text-left transition-all ${
                            selected
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                          }`}
                        >
                          <div className={`text-xs font-bold mb-1 ${selected ? "text-blue-700" : "text-slate-500"}`}>
                            {m.tagline}
                          </div>
                          <div className={`text-sm font-semibold ${selected ? "text-blue-900" : "text-slate-800"}`}>
                            {m.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 leading-tight">{m.description}</div>
                          {selected && (
                            <div className="mt-2 flex items-center gap-1">
                              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 flex items-center justify-center">
                                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                                  <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                </svg>
                              </div>
                              <span className="text-xs font-medium text-blue-600">Selected</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {rerunError && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {rerunError}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={closeRerun}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={startRerun}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Start Analysis
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
