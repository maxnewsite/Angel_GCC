"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export default function NewDealForm() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [startup, setStartup] = useState<any | null>(null);
  const [startupForm, setStartupForm] = useState({
    name: "",
    website: "",
    sector: "",
    hq_location: "",
    description: ""
  });
  const [dealForm, setDealForm] = useState({
    round_type: "Pre-Seed",
    instrument: "SAFE",
    target_amount: "",
    min_ticket: "",
    valuation: ""
  });
  const [highlights, setHighlights] = useState("");
  const [risks, setRisks] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");
  const [pitchDeck, setPitchDeck] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Check user role and load existing startup (for founders only)
  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      // Get user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (profile) {
        setUserRole(profile.role);

        // Only load existing startup for founders
        if (profile.role === "founder") {
          const { data: st } = await supabase
            .from("startups")
            .select("*")
            .eq("owner_user_id", uid)
            .order("created_at", { ascending: false })
            .limit(1);

          if (st && st.length > 0) setStartup(st[0]);
        }
      }
    }
    load();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size must be less than 10MB");
      return;
    }

    setPitchDeck(file);
  }

  async function ensureStartup() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) throw new Error("Not authenticated");

    // For founders: reuse existing startup if available
    if (userRole === "founder" && startup) {
      return startup;
    }

    // Create new startup
    const isFounder = userRole === "founder";

    const { data, error } = await supabase
      .from("startups")
      .insert({
        owner_user_id: isFounder ? uid : null,
        name: startupForm.name,
        website: startupForm.website || null,
        sector: startupForm.sector || null,
        hq_location: startupForm.hq_location || null,
        description: startupForm.description || null,
        created_by: uid,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Only cache startup for founders
    if (isFounder) {
      setStartup(data);
    }

    return data;
  }

  async function createDeal() {
    try {
      setUploading(true);

      const st = await ensureStartup();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        throw new Error("Not authenticated");
      }

      // Create the deal
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert({
          startup_id: st.id,
          created_by: uid,
          status: "submitted",
          round_type: dealForm.round_type,
          instrument: dealForm.instrument,
          target_amount: dealForm.target_amount ? Number(dealForm.target_amount) : null,
          min_ticket: dealForm.min_ticket ? Number(dealForm.min_ticket) : null,
          valuation: dealForm.valuation ? Number(dealForm.valuation) : null,
          highlights: highlights || null,
          risks: risks || null,
          use_of_funds: useOfFunds || null,
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (dealError) {
        throw new Error("Failed to create deal: " + dealError.message);
      }

      // Upload pitch deck if provided
      if (pitchDeck) {
        const fileName = `${deal.id}/${Date.now()}_${pitchDeck.name}`;

        const { error: uploadError } = await supabase.storage
          .from("deal-docs")
          .upload(fileName, pitchDeck, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Failed to upload pitch deck: " + uploadError.message);
        }

        // Create document record
        const { error: docError } = await supabase.from("documents").insert({
          deal_id: deal.id,
          startup_id: st.id,
          storage_path: fileName,
          file_name: pitchDeck.name,
          visibility: "internal",
          uploaded_by_user_id: uid,
          created_by: uid,
          created_at: new Date().toISOString(),
        });

        if (docError) {
          throw new Error("Failed to create document record: " + docError.message);
        }
      }

      alert("Deal submitted successfully!");
      router.push(`/app/deals/${deal.id}`);
    } catch (e: any) {
      console.error("Deal creation error:", e);
      alert(e.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  // Show existing startup for founders, or form for new startup
  const showStartupForm = userRole === "founder" ? !startup : true;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-2xl font-semibold">New deal submission</div>
        <div className="text-sm text-black/60">
          {userRole === "founder"
            ? "Create a submission (status = submitted) for screening."
            : "Create a deal submission. Deal will be flagged as internally sourced."}
        </div>
      </div>

      {showStartupForm ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Startup profile</div>
            <div className="text-xs text-black/60">
              {userRole === "founder"
                ? "You need a startup profile once. It will be reused for future deals."
                : "Enter details about the startup submitting this deal."}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Startup name *"
                value={startupForm.name}
                onChange={(e) => setStartupForm({ ...startupForm, name: e.target.value })}
              />
              <Input
                placeholder="Website"
                value={startupForm.website}
                onChange={(e) => setStartupForm({ ...startupForm, website: e.target.value })}
              />
              <Input
                placeholder="Sector (e.g., FinTech, AI)"
                value={startupForm.sector}
                onChange={(e) => setStartupForm({ ...startupForm, sector: e.target.value })}
              />
              <Input
                placeholder="HQ location (e.g., SF, Remote)"
                value={startupForm.hq_location}
                onChange={(e) => setStartupForm({ ...startupForm, hq_location: e.target.value })}
              />
              <div className="md:col-span-2">
                <Textarea
                  placeholder="Short description"
                  rows={4}
                  value={startupForm.description}
                  onChange={(e) => setStartupForm({ ...startupForm, description: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Startup</div>
            <div className="text-xs text-black/60">{startup.name}</div>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Deal terms</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Round type (e.g., Seed, Series A)"
              value={dealForm.round_type}
              onChange={(e) => setDealForm({ ...dealForm, round_type: e.target.value })}
            />
            <Input
              placeholder="Instrument (e.g., SAFE, Equity)"
              value={dealForm.instrument}
              onChange={(e) => setDealForm({ ...dealForm, instrument: e.target.value })}
            />
            <Input
              placeholder="Target amount ($)"
              type="number"
              value={dealForm.target_amount}
              onChange={(e) => setDealForm({ ...dealForm, target_amount: e.target.value })}
            />
            <Input
              placeholder="Minimum ticket ($)"
              type="number"
              value={dealForm.min_ticket}
              onChange={(e) => setDealForm({ ...dealForm, min_ticket: e.target.value })}
            />
            <div className="md:col-span-2">
              <Input
                placeholder="Valuation ($)"
                type="number"
                value={dealForm.valuation}
                onChange={(e) => setDealForm({ ...dealForm, valuation: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <Textarea
              placeholder="Key highlights and strengths"
              rows={3}
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
            />
            <Textarea
              placeholder="Known risks and concerns"
              rows={3}
              value={risks}
              onChange={(e) => setRisks(e.target.value)}
            />
            <Textarea
              placeholder="Use of funds / allocation plan"
              rows={3}
              value={useOfFunds}
              onChange={(e) => setUseOfFunds(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Pitch deck</div>
          <div className="text-xs text-black/60">
            Upload pitch deck PDF (max 10MB, required for AI screening).
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-dashed border-black/10 bg-white/50 p-6 backdrop-blur">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pitch-deck-upload"
              />
              <label
                htmlFor="pitch-deck-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
              >
                <div className="rounded-full bg-black/5 p-3">
                  <svg className="h-6 w-6 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-sm font-medium">
                  {pitchDeck ? pitchDeck.name : "Click to upload pitch deck"}
                </div>
                <div className="text-xs text-black/50">PDF up to 10MB</div>
              </label>
            </div>

            {pitchDeck && (
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/50 p-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium">{pitchDeck.name}</div>
                    <div className="text-xs text-black/50">
                      {(pitchDeck.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPitchDeck(null)}
                  className="text-sm text-black/50 hover:text-black"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-black/50">
          {userRole !== "founder" && "💡 Deal will be flagged as internally sourced (no founder owner)"}
        </div>
        <Button
          onClick={createDeal}
          disabled={(!startup && !startupForm.name) || uploading}
        >
          {uploading ? "Submitting..." : "Submit deal"}
        </Button>
      </div>
    </div>
  );
}
