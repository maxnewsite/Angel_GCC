"use client";

interface ScoreMeterProps {
  score: number;
  size?: "sm" | "lg";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-orange-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-orange-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Recommend to IC";
  if (score >= 60) return "Deep Dive Required";
  if (score >= 40) return "Request More Info";
  return "Strong Reject";
}

export function ScoreMeter({ score, size = "lg" }: ScoreMeterProps) {
  const color = getScoreColor(score);
  const bg = getScoreBg(score);
  const label = getScoreLabel(score);

  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-sm text-slate-500">/100</span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${score}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className={`text-6xl font-bold ${color}`}>{score}</div>
      <div className="text-sm text-slate-500 mt-1">/100</div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mt-4 max-w-md mx-auto">
        <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <div className={`mt-2 text-sm font-semibold ${color}`}>{label}</div>
      <div className="flex justify-between text-[10px] text-slate-400 max-w-md mx-auto mt-1">
        <span>&lt;40 Reject</span>
        <span>40-59 More Info</span>
        <span>60-79 Deep Dive</span>
        <span>80+ Recommend</span>
      </div>
    </div>
  );
}
