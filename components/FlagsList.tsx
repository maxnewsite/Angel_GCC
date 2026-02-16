"use client";

import type { Flag } from "@/lib/types";

interface FlagsListProps {
  greenFlags: Flag[];
  redFlags: Flag[];
}

export function FlagsList({ greenFlags, redFlags }: FlagsListProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Green Flags */}
      <div>
        <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full" />
          Green Flags ({greenFlags.length})
        </h4>
        {greenFlags.length === 0 ? (
          <p className="text-sm text-slate-400">No green flags detected</p>
        ) : (
          <div className="space-y-2">
            {greenFlags.map((flag, i) => (
              <div
                key={i}
                className="rounded-lg border border-green-200 bg-green-50 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">+</span>
                  <div>
                    <span className="text-xs font-medium text-green-600 bg-green-100 rounded px-1.5 py-0.5">
                      {flag.category}
                    </span>
                    <p className="text-sm font-medium text-green-800 mt-1">{flag.flag}</p>
                    <p className="text-xs text-green-600 mt-0.5">{flag.evidence}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Red Flags */}
      <div>
        <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-red-500 rounded-full" />
          Red Flags ({redFlags.length})
        </h4>
        {redFlags.length === 0 ? (
          <p className="text-sm text-slate-400">No red flags detected</p>
        ) : (
          <div className="space-y-2">
            {redFlags.map((flag, i) => (
              <div
                key={i}
                className="rounded-lg border border-red-200 bg-red-50 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">!</span>
                  <div>
                    <span className="text-xs font-medium text-red-600 bg-red-100 rounded px-1.5 py-0.5">
                      {flag.category}
                    </span>
                    <p className="text-sm font-medium text-red-800 mt-1">{flag.flag}</p>
                    <p className="text-xs text-red-600 mt-0.5">{flag.evidence}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
