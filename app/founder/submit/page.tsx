"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication
export const dynamic = 'force-dynamic';
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const SECTORS = [
  "SaaS", "Fintech", "Healthtech", "Edtech", "E-commerce", "AI/ML",
  "Climate/Clean Tech", "Biotech", "Hardware", "Marketplace", "Consumer",
  "Enterprise", "Cybersecurity", "Web3/Blockchain", "Other",
];

export default function SubmitPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  // Form state
  const [startupName, setStartupName] = useState("");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState("");
  const [hqLocation, setHqLocation] = useState("");
  const [description, setDescription] = useState("");
  const [foundingDate, setFoundingDate] = useState("");
  const [teamInfo, setTeamInfo] = useState("");
  const [tractionInfo, setTractionInfo] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [fundingAsk, setFundingAsk] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");

  // Files
  const [pitchDeck, setPitchDeck] = useState<File | null>(null);
  const [financials, setFinancials] = useState<File | null>(null);
  const [otherDocs, setOtherDocs] = useState<File[]>([]);

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    // Create submission
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        founder_id: session.user.id,
        startup_name: startupName,
        website: website || null,
        sector: sector || null,
        hq_location: hqLocation || null,
        description: description || null,
        founding_date: foundingDate || null,
        team_info: teamInfo || null,
        traction_info: tractionInfo || null,
        business_model: businessModel || null,
        funding_ask: fundingAsk || null,
        use_of_funds: useOfFunds || null,
      })
      .select()
      .single();

    if (subError || !submission) {
      setError(subError?.message || "Failed to create submission");
      setLoading(false);
      return;
    }

    // Upload files
    const filesToUpload: { file: File; type: "pitch_deck" | "financials" | "other" }[] = [];
    if (pitchDeck) filesToUpload.push({ file: pitchDeck, type: "pitch_deck" });
    if (financials) filesToUpload.push({ file: financials, type: "financials" });
    otherDocs.forEach((f) => filesToUpload.push({ file: f, type: "other" }));

    for (const { file, type } of filesToUpload) {
      const path = `${submission.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(path, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("documents").insert({
        submission_id: submission.id,
        file_name: file.name,
        file_type: type,
        storage_path: path,
        file_size: file.size,
      });
    }

    setLoading(false);
    router.push("/founder/dashboard");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Submit Your Startup</h2>
      <p className="text-sm text-slate-500 mb-6">
        Provide information about your startup for AI-powered investment analysis.
      </p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-2 flex-1 rounded-full ${
                step >= s ? "bg-blue-600" : "bg-blue-100"
              }`}
            />
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Startup Information</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Startup Name *
              </label>
              <Input
                value={startupName}
                onChange={(e) => setStartupName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HQ Location</label>
                <Input
                  value={hqLocation}
                  onChange={(e) => setHqLocation(e.target.value)}
                  placeholder="San Francisco, CA"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a sector</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Founding Date
              </label>
              <Input
                type="date"
                value={foundingDate}
                onChange={(e) => setFoundingDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description *
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your startup does, the problem you're solving, and your solution..."
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!startupName}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Team, Traction & Business</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Team Background
              </label>
              <Textarea
                value={teamInfo}
                onChange={(e) => setTeamInfo(e.target.value)}
                placeholder="Describe the founding team: backgrounds, experience, relevant expertise, team size..."
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Traction & Metrics
              </label>
              <Textarea
                value={tractionInfo}
                onChange={(e) => setTractionInfo(e.target.value)}
                placeholder="Describe your traction: users, revenue, growth rate, engagement metrics, milestones..."
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Model
              </label>
              <Textarea
                value={businessModel}
                onChange={(e) => setBusinessModel(e.target.value)}
                placeholder="How do you make money? Pricing, unit economics, margins, revenue model..."
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Funding Ask
              </label>
              <Textarea
                value={fundingAsk}
                onChange={(e) => setFundingAsk(e.target.value)}
                placeholder="How much are you raising? At what valuation? What instrument (SAFE, equity, convertible note)?"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Use of Funds
              </label>
              <Textarea
                value={useOfFunds}
                onChange={(e) => setUseOfFunds(e.target.value)}
                placeholder="How will you use the investment? Hiring, product development, marketing..."
                rows={2}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Upload Documents</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pitch Deck (PDF) *
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPitchDeck(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {pitchDeck && (
                <p className="text-xs text-green-600 mt-1">{pitchDeck.name} ({(pitchDeck.size / 1024 / 1024).toFixed(1)} MB)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Financial Data (Excel/CSV)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFinancials(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {financials && (
                <p className="text-xs text-green-600 mt-1">{financials.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Other Documents
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.pptx"
                onChange={(e) => setOtherDocs(Array.from(e.target.files || []))}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {otherDocs.length > 0 && (
                <p className="text-xs text-green-600 mt-1">{otherDocs.length} file(s) selected</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading || !startupName}>
                {loading ? "Submitting..." : "Submit for Analysis"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
