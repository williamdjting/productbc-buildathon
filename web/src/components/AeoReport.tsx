"use client";

import type { AeoReport, CriterionResult } from "@/lib/types";

const STATUS_CONFIG = {
  yes: { label: "Yes", class: "bg-green-100 text-green-800 border-green-200" },
  partial: {
    label: "Partial",
    class: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  no: { label: "No", class: "bg-red-100 text-red-800 border-red-200" },
  not_evaluated: {
    label: "N/A",
    class: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.not_evaluated;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${cfg.class}`}
    >
      {cfg.label}
    </span>
  );
}

function CriterionRow({
  label,
  criterion,
}: {
  label: string;
  criterion: CriterionResult;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <StatusBadge status={criterion.status} />
      </div>
      <p className="text-xs text-gray-600">{criterion.reason}</p>
      {criterion.evidence && criterion.evidence.length > 0 && (
        <ul className="space-y-0.5">
          {criterion.evidence.map((e, i) => (
            <li key={i} className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AeoReportProps {
  report: AeoReport;
}

export default function AeoReportView({ report }: AeoReportProps) {
  const ev = report.aeo_checklist_evaluation;
  const pfa = ev.page_fast_readable_accessible;

  return (
    <div className="space-y-3">
      {report.article.title && (
        <p className="text-sm text-gray-500">
          <span className="font-medium">Article:</span> {report.article.title}
        </p>
      )}

      <div className="space-y-2">
        <CriterionRow
          label="One-paragraph answer near top (40–80 words)"
          criterion={ev.one_paragraph_answer_near_top}
        />
        <CriterionRow
          label="Question-style headings"
          criterion={ev.question_style_headings_present}
        />
        <CriterionRow
          label="FAQ or HowTo schema/section"
          criterion={ev.faq_or_howto_schema_present}
        />
        <CriterionRow
          label="Consistent key concept definitions"
          criterion={ev.definitions_consistent}
        />
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-800">
            Page: fast, readable, accessible
          </p>
          <div className="pl-2 space-y-2">
            <CriterionRow label="Fast page" criterion={pfa.fast_page} />
            <CriterionRow label="Readable" criterion={pfa.readable} />
            <CriterionRow label="Accessible" criterion={pfa.accessible} />
          </div>
        </div>
      </div>
    </div>
  );
}
