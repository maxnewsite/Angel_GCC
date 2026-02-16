"use client";

import { useEffect, useState } from "react";
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

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<(Submission & { profiles: { email: string; full_name: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
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

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

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
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const status = STATUS_BADGES[sub.status];
                return (
                  <tr key={sub.id} className="border-b border-blue-50 hover:bg-blue-50/30 transition-colors">
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
                      {sub.status === "completed" ? (
                        <Button
                          variant="ghost"
                          onClick={() => router.push(`/admin/report/${sub.id}`)}
                        >
                          View Report
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => router.push(`/admin/review/${sub.id}`)}
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
