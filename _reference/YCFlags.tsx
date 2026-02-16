"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

type Flag = {
  flag: string;
  note: string;
};

type FlagsCatalog = {
  id: string;
  flag_type: "green" | "red";
  category: string;
  flag_text: string;
  description: string;
};

export function YCFlags({ dealId, onSaved }: { dealId: string; onSaved: () => Promise<void> }) {
  const [greenFlags, setGreenFlags] = useState<Flag[]>([]);
  const [redFlags, setRedFlags] = useState<Flag[]>([]);
  const [catalog, setCatalog] = useState<FlagsCatalog[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [showCatalog, setShowCatalog] = useState<false | "green" | "red">(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    loadData();
  }, [dealId]);

  async function loadData() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;

    // Load existing flags
    const { data: existingFlags } = await supabase
      .from("deal_flags")
      .select("green_flags, red_flags")
      .eq("deal_id", dealId)
      .eq("manager_user_id", uid)
      .maybeSingle();

    if (existingFlags) {
      setGreenFlags(existingFlags.green_flags || []);
      setRedFlags(existingFlags.red_flags || []);
    }

    // Load flags catalog
    const { data: cat } = await supabase
      .from("yc_flags_catalog")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("flag_text", { ascending: true });

    setCatalog(cat || []);
  }

  async function aiDetectFlags() {
    setAiScanning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) throw new Error("Not authenticated");

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-detect-flags`;
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
        throw new Error(data.error || "AI flag detection failed");
      }

      const data = await res.json();
      setGreenFlags(data.green_flags || []);
      setRedFlags(data.red_flags || []);

      alert("AI flag detection complete! Review and adjust as needed.");
    } catch (e: any) {
      alert(`AI flag detection failed: ${e.message}`);
    } finally {
      setAiScanning(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) throw new Error("Not logged in");

      const { error } = await supabase.from("deal_flags").upsert(
        {
          deal_id: dealId,
          manager_user_id: uid,
          green_flags: greenFlags,
          red_flags: redFlags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deal_id,manager_user_id" }
      );

      if (error) throw error;

      await onSaved();
      alert("Flags saved successfully.");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function addGreenFlag(flagText?: string) {
    setGreenFlags([...greenFlags, { flag: flagText || "", note: "" }]);
    setShowCatalog(false);
  }

  function addRedFlag(flagText?: string) {
    setRedFlags([...redFlags, { flag: flagText || "", note: "" }]);
    setShowCatalog(false);
  }

  function removeGreenFlag(index: number) {
    setGreenFlags(greenFlags.filter((_, i) => i !== index));
  }

  function removeRedFlag(index: number) {
    setRedFlags(redFlags.filter((_, i) => i !== index));
  }

  function updateGreenFlag(index: number, updates: Partial<Flag>) {
    const updated = [...greenFlags];
    updated[index] = { ...updated[index], ...updates };
    setGreenFlags(updated);
  }

  function updateRedFlag(index: number, updates: Partial<Flag>) {
    const updated = [...redFlags];
    updated[index] = { ...updated[index], ...updates };
    setRedFlags(updated);
  }

  const categories = ["all", ...Array.from(new Set(catalog.map((c) => c.category)))];
  const filteredCatalog = selectedCategory === "all"
    ? catalog
    : catalog.filter((c) => c.category === selectedCategory);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">YC-Style Flags</div>
            <div className="text-xs text-black/60">
              Mark red flags (warnings) and green flags (strengths) for IC evaluation
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={aiDetectFlags}
            disabled={aiScanning}
            className="flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {aiScanning ? "AI Analyzing..." : "AI Detect Flags"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Green Flags Section */}
          <div className="rounded-2xl border-2 border-green-500/20 bg-green-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
                  ✓
                </div>
                <div className="text-sm font-semibold text-green-900">Green Flags ({greenFlags.length})</div>
              </div>
              <button
                onClick={() => setShowCatalog("green")}
                className="text-xs text-green-700 hover:text-green-900"
              >
                + Add from catalog
              </button>
            </div>

            {greenFlags.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-sm text-black/40">No green flags yet</div>
                <button
                  onClick={() => addGreenFlag()}
                  className="mt-2 text-xs text-green-700 hover:text-green-900"
                >
                  + Add custom flag
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {greenFlags.map((flag, i) => (
                  <div key={i} className="rounded-xl border border-green-500/20 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Flag description"
                        value={flag.flag}
                        onChange={(e) => updateGreenFlag(i, { flag: e.target.value })}
                        className="flex-1 rounded-lg border border-green-500/20 bg-white px-3 py-1.5 text-sm font-medium text-green-900"
                      />
                      <button
                        onClick={() => removeGreenFlag(i)}
                        className="text-xs text-black/40 hover:text-black"
                      >
                        Remove
                      </button>
                    </div>
                    <Textarea
                      placeholder="Supporting evidence / notes"
                      rows={2}
                      value={flag.note}
                      onChange={(e) => updateGreenFlag(i, { note: e.target.value })}
                      className="border-green-500/20"
                    />
                  </div>
                ))}
                <button
                  onClick={() => addGreenFlag()}
                  className="w-full rounded-lg border-2 border-dashed border-green-500/30 bg-white/50 py-2 text-xs text-green-700 hover:bg-white hover:text-green-900"
                >
                  + Add custom flag
                </button>
              </div>
            )}
          </div>

          {/* Red Flags Section */}
          <div className="rounded-2xl border-2 border-red-500/20 bg-red-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                  !
                </div>
                <div className="text-sm font-semibold text-red-900">Red Flags ({redFlags.length})</div>
              </div>
              <button
                onClick={() => setShowCatalog("red")}
                className="text-xs text-red-700 hover:text-red-900"
              >
                + Add from catalog
              </button>
            </div>

            {redFlags.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-sm text-black/40">No red flags yet</div>
                <button
                  onClick={() => addRedFlag()}
                  className="mt-2 text-xs text-red-700 hover:text-red-900"
                >
                  + Add custom flag
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {redFlags.map((flag, i) => (
                  <div key={i} className="rounded-xl border border-red-500/20 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Flag description"
                        value={flag.flag}
                        onChange={(e) => updateRedFlag(i, { flag: e.target.value })}
                        className="flex-1 rounded-lg border border-red-500/20 bg-white px-3 py-1.5 text-sm font-medium text-red-900"
                      />
                      <button
                        onClick={() => removeRedFlag(i)}
                        className="text-xs text-black/40 hover:text-black"
                      >
                        Remove
                      </button>
                    </div>
                    <Textarea
                      placeholder="Supporting evidence / notes"
                      rows={2}
                      value={flag.note}
                      onChange={(e) => updateRedFlag(i, { note: e.target.value })}
                      className="border-red-500/20"
                    />
                  </div>
                ))}
                <button
                  onClick={() => addRedFlag()}
                  className="w-full rounded-lg border-2 border-dashed border-red-500/30 bg-white/50 py-2 text-xs text-red-700 hover:bg-white hover:text-red-900"
                >
                  + Add custom flag
                </button>
              </div>
            )}
          </div>

          {/* Catalog Modal */}
          {showCatalog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-black/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">
                      Standard {showCatalog === "green" ? "Green" : "Red"} Flags
                    </div>
                    <button
                      onClick={() => setShowCatalog(false)}
                      className="text-black/40 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          selectedCategory === cat
                            ? "bg-black text-white"
                            : "bg-black/5 text-black/60 hover:bg-black/10"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                  {filteredCatalog
                    .filter((c) => c.flag_type === showCatalog)
                    .map((flag) => (
                      <button
                        key={flag.id}
                        onClick={() =>
                          showCatalog === "green"
                            ? addGreenFlag(flag.flag_text)
                            : addRedFlag(flag.flag_text)
                        }
                        className="mb-2 w-full rounded-xl border border-black/10 bg-white p-3 text-left hover:bg-black/5"
                      >
                        <div className="text-sm font-semibold">{flag.flag_text}</div>
                        <div className="mt-1 text-xs text-black/60">{flag.description}</div>
                        <div className="mt-1 text-xs text-black/40">Category: {flag.category}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Flags"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
