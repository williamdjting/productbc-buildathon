"use client";

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label?: string;
}

export default function ScoreGauge({
  score,
  maxScore = 3,
  label,
}: ScoreGaugeProps) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 45 ? "bg-yellow-500" : "bg-red-500";
  const textColor =
    pct >= 75
      ? "text-green-700"
      : pct >= 45
      ? "text-yellow-700"
      : "text-red-700";

  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-gray-500 font-medium">{label}</p>}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-sm font-semibold w-16 text-right ${textColor}`}>
          {score.toFixed(2)} / {maxScore}
        </span>
      </div>
    </div>
  );
}
