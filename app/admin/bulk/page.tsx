"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication
export const dynamic = "force-dynamic";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { authFetch, runAnalysis } from "@/lib/api-client";
import { DEFAULT_MODEL, MODELS } from "@/lib/models";

const MAX_FILE_MB = 50;
// Pitches analysed at the same time; keeps well inside API rate limits
const CONCURRENCY = 2;

type ItemStatus = "queued" | "uploading" | "analyzing" | "done" | "uploaded" | "error";

interface Item {
  key: string;
  file: File;
  name: string;
  status: ItemStatus;
  submissionId?: string;
  step: number;
  message: string;
  score?: number;
  recommendation?: string;
  error?: string;
}

const STATUS_STYLE: Record<ItemStatus, string> = {
  queued: "bg-slate-100 text-slate-600",
  uploading: "bg-blue-100 text-blue-700",
  analyzing: "bg-blue-100 text-blue-700",
  uploaded: "bg-slate-100 text-slate-700",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  analyzing: "Analyzing",
  uploaded: "Uploaded",
  done: "Screened",
  error: "Failed",
};

function nameFromFile(file: File): string {
  return file.name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Untitled pitch";
}

function safeStorageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
}

function scoreClass(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-orange-500";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function csvCell(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState("");

  // Warn before closing the tab while pitches are being processed
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addFiles(files: FileList | File[]) {
    const accepted: Item[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) rejected.push(`${file.name} (not a PDF)`);
      else if (file.size > MAX_FILE_MB * 1024 * 1024) rejected.push(`${file.name} (over ${MAX_FILE_MB} MB)`);
      else
        accepted.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          name: nameFromFile(file),
          status: "queued",
          step: 0,
          message: "",
        });
    }
    setItems((prev) => [...prev, ...accepted]);
    setNotice(rejected.length ? `Skipped: ${rejected.join(", ")}` : "");
  }

  /** Creates the submission row, uploads the PDF and registers the document. */
  async function uploadItem(item: Item, userId: string): Promise<string> {
    update(item.key, { status: "uploading", message: "Uploading pitch deck...", error: undefined });

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({ founder_id: userId, startup_name: item.name, status: "in_review" })
      .select("id")
      .single();
    if (subError || !submission) throw new Error(subError?.message || "Could not create submission");

    const path = `${submission.id}/${Date.now()}_${safeStorageName(item.file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(path, item.file, { contentType: "application/pdf" });

    const { error: docError } = uploadError
      ? { error: null }
      : await supabase.from("documents").insert({
          submission_id: submission.id,
          file_name: item.file.name,
          file_type: "pitch_deck",
          storage_path: path,
          file_size: item.file.size,
        });

    if (uploadError || docError) {
      // Don't leave an empty submission behind
      await authFetch("/api/delete-submission", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submission.id }),
      }).catch(() => {});
      throw new Error(`Upload failed: ${(uploadError ?? docError)!.message}`);
    }

    update(item.key, { submissionId: submission.id, message: "Uploaded" });
    return submission.id;
  }

  async function analyzeItem(item: Item, submissionId: string) {
    update(item.key, { status: "analyzing", step: 0, message: "Starting analysis..." });
    const final = await runAnalysis(submissionId, model, (event) => {
      const patch: Partial<Item> = {};
      if (event.step !== undefined) patch.step = event.step;
      if (event.message) patch.message = event.message;
      if (event.startup_name) patch.name = event.startup_name;
      update(item.key, patch);
    });
    update(item.key, {
      status: "done",
      step: 6,
      message: final.message ?? "Analysis complete",
      score: final.overall_score,
      recommendation: final.recommendation,
      name: final.startup_name ?? item.name,
    });
  }

  async function processItem(item: Item, userId: string) {
    try {
      const submissionId = item.submissionId ?? (await uploadItem(item, userId));
      if (autoAnalyze) await analyzeItem(item, submissionId);
      else update(item.key, { status: "uploaded", message: "Ready for review" });
    } catch (err) {
      update(item.key, { status: "error", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function start(only?: Item[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotice("Your session has expired — please sign in again.");
      return;
    }

    const queue = only ?? items.filter((it) => it.status === "queued");
    if (queue.length === 0) return;

    setRunning(true);
    let next = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (next < queue.length) {
        const item = queue[next++];
        await processItem(item, session.user.id);
      }
    });
    await Promise.all(workers);
    setRunning(false);
  }

  function exportCsv() {
    const rows = [
      ["Startup", "File", "Status", "Score", "Recommendation", "Report link"],
      ...items.map((it) => [
        it.name,
        it.file.name,
        STATUS_LABEL[it.status],
        it.score ?? "",
        it.recommendation ?? it.error ?? "",
        it.submissionId && it.status === "done" ? `${window.location.origin}/admin/report/${it.submissionId}` : "",
      ]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pitch-screening-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const queuedCount = items.filter((it) => it.status === "queued").length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const failedCount = items.filter((it) => it.status === "error").length;
  const finished = items.filter((it) => ["done", "uploaded", "error"].includes(it.status)).length;

  // Screened pitches first, best score on top
  const sorted = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      if (running) return a.i - b.i;
      return (b.it.score ?? -1) - (a.it.score ?? -1) || a.i - b.i;
    })
    .map(({ it }) => it);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button variant="ghost" onClick={() => router.push("/admin/dashboard")} className="mb-2">
            &larr; Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold text-slate-900">Bulk Pitch Screening</h2>
          <p className="text-sm text-slate-500">
            Upload the pitch decks you have collected. Each PDF becomes a submission and gets an AI screening report.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">1. Add pitch decks</h3>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
              dragOver ? "border-blue-500 bg-blue-50" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50/40"
            }`}
          >
            <p className="text-base font-medium text-slate-800">Drop PDF pitch decks here, or click to choose files</p>
            <p className="text-sm text-slate-500 mt-1">
              Multiple files allowed · PDF only · up to {MAX_FILE_MB} MB each
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {notice && <p className="mt-3 text-sm text-amber-700">{notice}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">2. Screening options</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {MODELS.map((m) => (
              <button
                key={m.id}
                disabled={running}
                onClick={() => setModel(m.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all disabled:opacity-60 ${
                  model === m.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className={`text-xs font-bold ${model === m.id ? "text-blue-700" : "text-slate-500"}`}>{m.tagline}</div>
                <div className="text-sm font-semibold text-slate-800">{m.name}</div>
                <div className="text-xs text-slate-500 mt-1">{m.description}</div>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoAnalyze}
              disabled={running}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Run AI screening right after upload (otherwise pitches are only uploaded for later review)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => start()} disabled={running || queuedCount === 0}>
              {running
                ? `Processing ${finished}/${items.length}...`
                : autoAnalyze
                  ? `Upload & screen ${queuedCount} pitch${queuedCount === 1 ? "" : "es"}`
                  : `Upload ${queuedCount} pitch${queuedCount === 1 ? "" : "es"}`}
            </Button>
            {failedCount > 0 && !running && (
              <Button variant="secondary" onClick={() => start(items.filter((it) => it.status === "error"))}>
                Retry {failedCount} failed
              </Button>
            )}
            {items.length > 0 && !running && (
              <Button variant="ghost" onClick={exportCsv}>Export results (CSV)</Button>
            )}
            {running && (
              <span className="text-xs text-slate-500">
                Keep this tab open until processing finishes. Each pitch takes about 1–3 minutes.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">3. Results</h3>
              <span className="text-sm text-slate-500">
                {doneCount} screened · {failedCount} failed · {items.length} total
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blue-100 bg-blue-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pitch</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((it) => (
                    <tr key={it.key} className="border-b border-blue-50 align-top">
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-medium text-slate-900">{it.name}</div>
                        <div className="text-xs text-slate-400 truncate">{it.file.name}</div>
                        {it.status === "analyzing" && (
                          <div className="mt-2">
                            <div className="h-1.5 w-full rounded-full bg-slate-100">
                              <div
                                className="h-1.5 rounded-full bg-blue-600 transition-all duration-500"
                                style={{ width: `${Math.max(4, (it.step / 6) * 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-blue-600 mt-1">{it.message}</p>
                          </div>
                        )}
                        {it.status === "done" && it.recommendation && (
                          <p className="text-xs text-slate-600 mt-1">{it.recommendation}</p>
                        )}
                        {it.status === "error" && <p className="text-xs text-red-600 mt-1">{it.error}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[it.status]}`}>
                          {STATUS_LABEL[it.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {it.score !== undefined ? (
                          <span className={`text-lg font-bold ${scoreClass(it.score)}`}>{it.score}</span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {it.status === "done" && it.submissionId && (
                          <Button variant="ghost" onClick={() => window.open(`/admin/report/${it.submissionId}`, "_blank")}>
                            View Report
                          </Button>
                        )}
                        {it.status === "uploaded" && it.submissionId && (
                          <Button variant="ghost" onClick={() => window.open(`/admin/review/${it.submissionId}`, "_blank")}>
                            Review
                          </Button>
                        )}
                        {it.status === "queued" && !running && (
                          <button
                            onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
