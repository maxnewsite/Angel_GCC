"use client";

import { useState } from "react";
import type { CriterionScore } from "@/lib/types";

function getBarColor(score: number): string {
  if (score >= 4) return "bg-green-500";
  if (score >= 3) return "bg-yellow-500";
  if (score >= 2) return "bg-orange-500";
  return "bg-red-500";
}

export function CriteriaScores({ scores }: { scores: CriterionScore[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {scores.map((s) => (
        <div key={s.key} className="rounded-xl border border-blue-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">{s.criterion}</span>
              <span className="text-[10px] text-slate-400">weight: {s.weight}x</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{s.score}/5</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${getBarColor(s.score)} rounded-full transition-all`}
              style={{ width: `${(s.score / 5) * 100}%` }}
            />
          </div>
          <button
            onClick={() => setExpanded(expanded === s.key ? null : s.key)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {expanded === s.key ? "Hide rationale" : "Show rationale"}
          </button>
          {expanded === s.key && (
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{s.rationale}</p>
          )}
        </div>
      ))}
    </div>
  );
}
