"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

export function AnalystScreeningEditor({ dealId, onSaved }: { dealId: string; onSaved: () => Promise<void> }) {
  const [criteria, setCriteria] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; note: string }>>({});
  const [decision, setDecision] = useState<"recommend"|"not_recommend"|"needs_info">("needs_info");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<{score: number; recommendation: string; rationale: string} | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      const { data: c } = await supabase
        .from("screening_criteria")
        .select("id,name,description,weight,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      setCriteria(c ?? []);

      const { data: s } = await supabase
        .from("analyst_screening_scores")
        .select("criterion_id,score,note")
        .eq("deal_id", dealId)
        .eq("analyst_user_id", uid);

      const next: Record<string, { score: number; note: string }> = {};
      (s ?? []).forEach((row: any) => {
        next[row.criterion_id] = { score: row.score, note: row.note ?? "" };
      });
      setScores(next);

      const { data: r } = await supabase
        .from("analyst_screening_reviews")
        .select("decision,summary_memo")
        .eq("deal_id", dealId)
        .eq("analyst_user_id", uid)
        .maybeSingle();

      if (r?.decision) setDecision(r.decision);
      if (r?.summary_memo) setMemo(r.summary_memo);

      // Fetch existing AI recommendation
      const { data: aiRec } = await supabase
        .from("ai_recommendations")
        .select("score,recommendation_text,rationale")
        .eq("deal_id", dealId)
        .maybeSingle();

      if (aiRec) {
        setRecommendation({
          score: aiRec.score,
          recommendation: aiRec.recommendation_text,
          rationale: aiRec.rationale,
        });
      }
    })();
  }, [dealId]);

  function computeOverall() {
    if (!criteria.length) return null;
    let num = 0;
    let den = 0;
    for (const c of criteria) {
      const w = Number(c.weight ?? 1);
      const v = Number(scores[c.id]?.score ?? 3);
      num += w * v;
      den += w;
    }
    return den ? Math.round((num / den) * 100) / 100 : null;
  }

  async function aiScreen() {
    setAiScanning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) throw new Error("Not authenticated");

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-screen-deal`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ deal_id: dealId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `AI screening failed with status ${res.status}`);
      }

      const data = await res.json();

      // Populate scores with AI results
      const nextScores: Record<string, { score: number; note: string }> = {};
      data.criteria_scores.forEach((c: any) => {
        nextScores[c.criterion_id] = {
          score: c.score,
          note: c.note,
        };
      });
      setScores(nextScores);

      // Set the overall assessment as the memo
      if (data.overall_assessment) {
        setMemo(data.overall_assessment);
      }

      alert("AI screening complete! Review and adjust scores as needed.");
    } catch (e: any) {
      console.error("AI screening error:", e);
      alert(`AI screening failed: ${e.message || String(e)}`);
    } finally {
      setAiScanning(false);
    }
  }

  async function aiRecommend() {
    setAiRecommending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) throw new Error("Not authenticated");

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-recommend-deal`;
      console.log("Calling AI Recommender:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ deal_id: dealId }),
      });

      console.log("AI Recommender response status:", res.status);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("AI Recommender error:", data);
        throw new Error(data.error || `AI recommendation failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("AI Recommender success:", data);

      setRecommendation({
        score: data.score,
        recommendation: data.recommendation,
        rationale: data.rationale,
      });

      alert("AI Recommendation generated successfully!");
    } catch (e: any) {
      console.error("AI recommendation error:", e);
      alert(`AI recommendation failed: ${e.message || String(e)}`);
    } finally {
      setAiRecommending(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) throw new Error("Not logged in");

      // upsert 7 scores
      const payloadScores = criteria.map((c) => ({
        deal_id: dealId,
        analyst_user_id: uid,
        criterion_id: c.id,
        score: Number(scores[c.id]?.score ?? 3),
        note: scores[c.id]?.note || null,
      }));

      const { error: sErr } = await supabase
        .from("analyst_screening_scores")
        .upsert(payloadScores, { onConflict: "deal_id,analyst_user_id,criterion_id" });

      if (sErr) throw sErr;

      const overall = computeOverall();

      const { error: rErr } = await supabase
        .from("analyst_screening_reviews")
        .upsert(
          {
            deal_id: dealId,
            analyst_user_id: uid,
            overall_score: overall,
            decision,
            summary_memo: memo || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "deal_id,analyst_user_id" }
        );

      if (rErr) throw rErr;

      await onSaved();
      alert("Analysis saved successfully.");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const overall = computeOverall();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Analyst Screening (7 criteria)</div>
            <div className="text-xs text-black/60">
              Score each criterion 1–5 and save your analysis memo + recommendation.
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={aiScreen}
              disabled={aiScanning}
              className="flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {aiScanning ? "AI Analyzing..." : "AI Screen Pitch Deck"}
            </Button>
            <Button
              variant="primary"
              onClick={aiRecommend}
              disabled={aiRecommending || !memo || criteria.length === 0}
              className="flex items-center gap-2"
              title="Generate AI recommendation based on all screening data"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {aiRecommending ? "Analyzing..." : "AI Recommender"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* AI Recommendation Meter */}
        {recommendation && (
          <div className="mb-6 rounded-2xl overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-blue-900">AI Recommendation</div>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold ${
                    recommendation.score >= 80 ? "text-green-600" :
                    recommendation.score >= 60 ? "text-orange-600" :
                    recommendation.score >= 40 ? "text-yellow-600" :
                    "text-red-600"
                  }`}>
                    {recommendation.score}
                  </div>
                  <div className="text-sm text-black/50">/ 100</div>
                </div>
              </div>

              {/* Visual meter */}
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden mb-3">
                <div
                  className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                    recommendation.score >= 80 ? "bg-gradient-to-r from-green-400 to-green-600" :
                    recommendation.score >= 60 ? "bg-gradient-to-r from-orange-400 to-orange-600" :
                    recommendation.score >= 40 ? "bg-gradient-to-r from-yellow-400 to-yellow-600" :
                    "bg-gradient-to-r from-red-400 to-red-600"
                  }`}
                  style={{ width: `${recommendation.score}%` }}
                />
              </div>

              {/* Score thresholds */}
              <div className="grid grid-cols-4 gap-1 text-xs mb-3">
                <div className={`text-center p-1.5 rounded ${recommendation.score < 40 ? "bg-red-100 text-red-800 font-semibold" : "text-black/40"}`}>
                  &lt;40: Reject
                </div>
                <div className={`text-center p-1.5 rounded ${recommendation.score >= 40 && recommendation.score < 60 ? "bg-yellow-100 text-yellow-800 font-semibold" : "text-black/40"}`}>
                  40-59: More Info
                </div>
                <div className={`text-center p-1.5 rounded ${recommendation.score >= 60 && recommendation.score < 80 ? "bg-orange-100 text-orange-800 font-semibold" : "text-black/40"}`}>
                  60-79: Deep Dive
                </div>
                <div className={`text-center p-1.5 rounded ${recommendation.score >= 80 ? "bg-green-100 text-green-800 font-semibold" : "text-black/40"}`}>
                  80+: Recommend
                </div>
              </div>

              {/* Recommendation text */}
              <div className={`p-3 rounded-xl mb-3 ${
                recommendation.score >= 80 ? "bg-green-50 border border-green-200" :
                recommendation.score >= 60 ? "bg-orange-50 border border-orange-200" :
                recommendation.score >= 40 ? "bg-yellow-50 border border-yellow-200" :
                "bg-red-50 border border-red-200"
              }`}>
                <div className="text-sm font-medium mb-1">
                  {recommendation.recommendation}
                </div>
              </div>

              {/* Rationale (collapsible) */}
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-700 hover:text-blue-900 font-medium mb-2">
                  View detailed rationale
                </summary>
                <div className="mt-2 p-3 bg-white/80 rounded-xl border border-black/10 text-black/70 whitespace-pre-wrap leading-relaxed">
                  {recommendation.rationale}
                </div>
              </details>
            </div>
          </div>
        )}

        {criteria.length === 0 ? (
          <div className="text-sm text-black/60">
            No criteria found. Seed the <code>screening_criteria</code> table with 7 rows.
          </div>
        ) : (
          <div className="space-y-3">
            {criteria.map((c) => {
              const v = scores[c.id]?.score ?? 3;
              return (
                <div key={c.id} className="rounded-2xl border border-black/10 bg-white/50 p-3 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      {c.description ? (
                        <div className="mt-1 text-xs text-black/60">{c.description}</div>
                      ) : null}
                    </div>
                    <div className="text-xs text-black/50">Weight: {c.weight ?? 1}</div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={v}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [c.id]: { score: Number(e.target.value), note: prev[c.id]?.note ?? "" },
                        }))
                      }
                      className="w-full"
                    />
                    <div className="w-10 text-right text-sm font-medium">{v}</div>
                  </div>

                  <Textarea
                    className="mt-2"
                    rows={5}
                    placeholder="AI will write detailed analysis notes here, or you can write your own"
                    value={scores[c.id]?.note ?? ""}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [c.id]: { score: prev[c.id]?.score ?? 3, note: e.target.value },
                      }))
                    }
                  />
                </div>
              );
            })}

            <div className="rounded-2xl border border-black/10 bg-white/50 p-3 backdrop-blur">
              <div className="text-xs text-black/60">Overall score (weighted)</div>
              <div className="text-lg font-semibold">{overall ?? "—"}</div>

              <div className="mt-3 space-y-2">
                <select
                  className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm backdrop-blur"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as any)}
                >
                  <option value="recommend">Recommend</option>
                  <option value="needs_info">Needs info</option>
                  <option value="not_recommend">Not recommend</option>
                </select>

                <Textarea
                  rows={4}
                  placeholder="Executive summary memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />

                <div className="rounded-lg bg-blue-50/50 border border-blue-200/50 p-3 text-xs text-blue-800">
                  <div className="font-semibold mb-1">ℹ️ Note for Analysts</div>
                  <div>
                    Your analysis will be visible to the dealflow manager and IC members.
                    Only the dealflow manager can submit recommendations to the IC.
                  </div>
                </div>

                <Button onClick={save} disabled={saving} className="w-full">
                  {saving ? "Saving…" : "Save Analysis"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
