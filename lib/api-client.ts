"use client";

import { createClient } from "@/lib/supabase/client";

export interface ExtractionStats {
  fieldsTotal: number;
  fieldsPopulated: number;
  wordCount: number;
}

export interface AnalysisEvent {
  step?: number;
  total?: number;
  message?: string;
  done?: boolean;
  error?: string;
  extractionStats?: ExtractionStats;
  overall_score?: number;
  recommendation?: string;
  startup_name?: string;
}

/** fetch() that attaches the current Supabase session token. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await createClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

/**
 * Runs the analysis pipeline for one submission, forwarding each progress
 * event to onEvent. Resolves with the final event; rejects on error.
 */
export async function runAnalysis(
  submissionId: string,
  model: string,
  onEvent: (event: AnalysisEvent) => void,
  signal?: AbortSignal
): Promise<AnalysisEvent> {
  const res = await authFetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submission_id: submissionId, model }),
    signal,
  });

  if (!res.ok || !res.body) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Analysis request failed (${res.status})`);
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
      let event: AnalysisEvent;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (event.error) throw new Error(event.error);
      onEvent(event);
      if (event.done) return event;
    }
  }

  throw new Error("Connection lost before the analysis finished. Please re-run it.");
}
