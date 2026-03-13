import type { CriterionResult, Criterion } from "@/lib/types";

const STATUS_CONFIG = {
  pass: {
    icon: "✓",
    containerClass: "border-green-200 bg-green-50",
    iconClass: "text-green-600",
    label: "Pass",
    labelClass: "bg-green-100 text-green-700",
  },
  warn: {
    icon: "⚠",
    containerClass: "border-yellow-200 bg-yellow-50",
    iconClass: "text-yellow-600",
    label: "Warn",
    labelClass: "bg-yellow-100 text-yellow-700",
  },
  fail: {
    icon: "✗",
    containerClass: "border-red-200 bg-red-50",
    iconClass: "text-red-600",
    label: "Fail",
    labelClass: "bg-red-100 text-red-700",
  },
  na: {
    icon: "–",
    containerClass: "border-gray-100 bg-gray-50",
    iconClass: "text-gray-400",
    label: "N/A",
    labelClass: "bg-gray-100 text-gray-500",
  },
} as const;

const IMPACT_CLASS = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
} as const;

const CATEGORY_CLASS = "bg-blue-100 text-blue-700";

interface ImprovementCardProps {
  result: CriterionResult;
  criterion: Criterion;
}

export default function ImprovementCard({
  result,
  criterion,
}: ImprovementCardProps) {
  const cfg = STATUS_CONFIG[result.status];

  // Collapse N/A cards — they're not useful to the user
  if (result.status === "na") return null;

  return (
    <div className={`border rounded-lg p-4 space-y-2 ${cfg.containerClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-base font-bold flex-shrink-0 ${cfg.iconClass}`}>
            {cfg.icon}
          </span>
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            {criterion.title}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.labelClass}`}
          >
            {cfg.label}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_CLASS[criterion.impact]}`}
          >
            {criterion.impact}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_CLASS}`}
          >
            {criterion.category.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-gray-600 leading-relaxed">{result.reason}</p>

      {/* Evidence quotes */}
      {result.evidence.length > 0 && (
        <div className="space-y-1">
          {result.evidence.map((e, i) => (
            <p
              key={i}
              className="text-xs font-mono bg-white bg-opacity-70 rounded px-2 py-1 text-gray-700 border border-white border-opacity-50 truncate"
              title={e}
            >
              &ldquo;{e}&rdquo;
            </p>
          ))}
        </div>
      )}

      {/* Suggestion — only shown for warn/fail */}
      {result.suggestion && (
        <div className="text-xs text-gray-800 bg-white bg-opacity-60 rounded px-3 py-2 border border-current border-opacity-10">
          <span className="font-semibold">Fix: </span>
          {result.suggestion}
        </div>
      )}
    </div>
  );
}
