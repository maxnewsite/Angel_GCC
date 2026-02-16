"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering - requires authentication and real-time data
export const dynamic = 'force-dynamic';
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import type { Submission } from "@/lib/types";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  in_review: { label: "In Review", variant: "warning" },
  analyzing: { label: "AI Analyzing", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default function FounderDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("founder_id", session.user.id)
        .order("created_at", { ascending: false });
      setSubmissions((data as Submission[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Submissions</h2>
          <p className="text-sm text-slate-500">Track the status of your startup submissions</p>
        </div>
        <Button onClick={() => router.push("/founder/submit")}>New Submission</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">You haven&apos;t submitted any startups yet.</p>
            <Button onClick={() => router.push("/founder/submit")}>Submit Your Startup</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => {
            const status = STATUS_BADGES[sub.status];
            return (
              <Card key={sub.id}>
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{sub.startup_name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {sub.sector && <span className="text-sm text-slate-500">{sub.sector}</span>}
                        <span className="text-sm text-slate-400">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
