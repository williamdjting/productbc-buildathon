"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ScoreRing from "@/components/ScoreRing";
import ImprovementCard from "@/components/ImprovementCard";
import { loadSession, updateSession } from "@/lib/session";
import { getAllCriteria } from "@/lib/checklists";
import type { SessionData, MetadataGrade } from "@/lib/types";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "Blog Post",
  product: "Product Page",
  landing: "Landing Page",
  howto: "How-to Guide",
  news: "News / Editorial",
};

const STATUS_ORDER: Record<string, number> = {
  fail: 0,
  warn: 1,
  pass: 2,
  na: 3,
};

const META_STATUS_CONFIG = {
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
} as const;

function MetadataGradeCard({ grade }: { grade: MetadataGrade }) {
  const cfg = META_STATUS_CONFIG[grade.status];
  return (
    <div className={`border rounded-lg p-4 space-y-2 ${cfg.borderClass} ${cfg.bgClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-base font-bold flex-shrink-0 ${cfg.iconClass}`}>
            {cfg.icon}
          </span>
          <p className="text-sm font-semibold text-[#D4DBE8] leading-snug">
            {grade.title}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.labelClass}`}
        >
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-[#6B7A99] leading-relaxed">{grade.reason}</p>
      {grade.suggestion && (
        <div className="text-xs text-[#A0AABF] bg-black/20 rounded px-3 py-2 border border-white/[0.05]">
          <span className="font-semibold text-[#D4DBE8]">Fix: </span>
          {grade.suggestion}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  if (!session) return null;

  const { report, originalText, metadataReport } = session;
  const allCriteria = getAllCriteria();
  const criteriaMap = new Map(allCriteria.map((c) => [c.id, c]));

  const sortedResults = [...report.results].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  const failCount = report.results.filter((r) => r.status === "fail").length;
  const warnCount = report.results.filter((r) => r.status === "warn").length;

  const sortedMetaGrades = metadataReport
    ? [...metadataReport.grades].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      )
    : [];

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText, report }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Optimization failed");
      updateSession({ optimizedText: data.optimizedText });
      router.push("/optimized");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <StepHeader step={2} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Detected content type */}
        <div className="fade-up-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[#4A5670]">Detected as:</span>
          <span className="font-semibold text-[#D4DBE8]">
            {CONTENT_TYPE_LABELS[report.detectedContentType] ??
              report.detectedContentType}
          </span>
          {report.contentTypeConfidence === "low" && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              ⚠ Low confidence — verify this is correct
            </span>
          )}
        </div>

        {/* Score rings */}
        <div className="fade-up-2 bg-[#0C1018] border border-white/[0.07] rounded-xl p-6">
          <div className="flex justify-around flex-wrap gap-4">
            <ScoreRing score={report.overallScore} label="Overall" size={110} />
            <ScoreRing score={report.aeoScore} label="AEO Score" size={110} />
            <ScoreRing score={report.geoScore} label="GEO Score" size={110} />
            {metadataReport && (
              <ScoreRing
                score={metadataReport.score}
                label="Metadata"
                size={110}
              />
            )}
          </div>

          {(failCount > 0 || warnCount > 0) && (
            <div className="flex justify-center gap-4 mt-4 text-xs">
              {failCount > 0 && (
                <span className="text-rose-400 font-medium">
                  {failCount} failing
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-400 font-medium">
                  {warnCount} needs improvement
                </span>
              )}
            </div>
          )}
        </div>

        {/* Improvement cards */}
        <div className="fade-up-3 space-y-2">
          <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">
            Criteria breakdown
          </h2>
          {sortedResults.map((result) => {
            const criterion = criteriaMap.get(result.id);
            if (!criterion) return null;
            return (
              <ImprovementCard
                key={result.id}
                result={result}
                criterion={criterion}
              />
            );
          })}
        </div>

        {/* Metadata grades */}
        {metadataReport && sortedMetaGrades.length > 0 && (
          <div className="fade-up-4 space-y-2">
            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">
                Metadata grades
              </h2>
              <p className="text-xs text-[#3D4A60]">
                Based on the live HTML &lt;head&gt; of the scraped URL
              </p>
            </div>
            {sortedMetaGrades.map((grade) => (
              <MetadataGradeCard key={grade.id} grade={grade} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg px-4 py-3 text-sm flex justify-between items-start gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="underline text-rose-400/70 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* CTA */}
        <div className="fade-up-5">
          <button
            onClick={handleOptimize}
            disabled={loading}
            className="w-full py-3 bg-[#00D4A8] text-[#03100D] font-semibold rounded-lg hover:bg-[#00BFA0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm tracking-wide"
          >
            {loading ? "Optimizing…" : "Optimize Article →"}
          </button>
        </div>
      </main>
    </div>
  );
}
