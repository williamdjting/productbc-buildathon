import type { CriterionResult, Criterion } from "@/lib/types";

const STATUS_CONFIG = {
  pass: {
    icon: "✓",
    borderClass: "border-[#00D4A8]/20",
    bgClass: "bg-[rgba(0,212,168,0.04)]",
    iconClass: "text-[#00D4A8]",
    label: "Pass",
    labelClass: "bg-[rgba(0,212,168,0.12)] text-[#00D4A8]",
  },
  warn: {
    icon: "⚠",
    borderClass: "border-amber-500/20",
    bgClass: "bg-amber-500/[0.04]",
    iconClass: "text-amber-400",
    label: "Warn",
    labelClass: "bg-amber-500/10 text-amber-400",
  },
  fail: {
    icon: "✗",
    borderClass: "border-rose-500/20",
    bgClass: "bg-rose-500/[0.04]",
    iconClass: "text-rose-400",
    label: "Fail",
    labelClass: "bg-rose-500/10 text-rose-400",
  },
  na: {
    icon: "–",
    borderClass: "border-white/[0.05]",
    bgClass: "bg-white/[0.02]",
    iconClass: "text-[#3D4A60]",
    label: "N/A",
    labelClass: "bg-white/[0.05] text-[#3D4A60]",
  },
} as const;

const IMPACT_CLASS = {
  high: "bg-rose-500/10 text-rose-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-white/[0.05] text-[#6B7A99]",
} as const;

interface ImprovementCardProps {
  result: CriterionResult;
  criterion: Criterion;
}

export default function ImprovementCard({
  result,
  criterion,
}: ImprovementCardProps) {
  const cfg = STATUS_CONFIG[result.status];

  if (result.status === "na") return null;

  return (
    <div className={`border rounded-lg p-4 space-y-2 ${cfg.borderClass} ${cfg.bgClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-base font-bold flex-shrink-0 ${cfg.iconClass}`}>
            {cfg.icon}
          </span>
          <p className="text-sm font-semibold text-[#D4DBE8] leading-snug">
            {criterion.title}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.labelClass}`}>
            {cfg.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_CLASS[criterion.impact]}`}>
            {criterion.impact}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[rgba(0,212,168,0.1)] text-[#00D4A8]">
            {criterion.category.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-[#6B7A99] leading-relaxed">{result.reason}</p>

      {/* Evidence quotes */}
      {result.evidence.length > 0 && (
        <div className="space-y-1">
          {result.evidence.map((e, i) => (
            <p
              key={i}
              className="text-xs font-mono bg-black/30 rounded px-2 py-1 text-[#7A8BA8] border border-white/[0.05] truncate"
              title={e}
            >
              &ldquo;{e}&rdquo;
            </p>
          ))}
        </div>
      )}

      {/* Suggestion */}
      {result.suggestion && (
        <div className="text-xs text-[#A0AABF] bg-black/20 rounded px-3 py-2 border border-white/[0.05]">
          <span className="font-semibold text-[#D4DBE8]">Fix: </span>
          {result.suggestion}
        </div>
      )}
    </div>
  );
}
