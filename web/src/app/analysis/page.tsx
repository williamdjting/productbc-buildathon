"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ScoreRing from "@/components/ScoreRing";
import ImprovementCard from "@/components/ImprovementCard";
import { loadSession, updateSession } from "@/lib/session";
import { getAllCriteria } from "@/lib/checklists";
import type { SessionData } from "@/lib/types";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "Blog Post",
  product: "Product Page",
  landing: "Landing Page",
  howto: "How-to Guide",
  news: "News / Editorial",
};

// Sort order: fail first, then warn, then pass (na is hidden by ImprovementCard)
const STATUS_ORDER: Record<string, number> = {
  fail: 0,
  warn: 1,
  pass: 2,
  na: 3,
};

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

  const { report, originalText } = session;
  const allCriteria = getAllCriteria();
  const criteriaMap = new Map(allCriteria.map((c) => [c.id, c]));

  const sortedResults = [...report.results].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  const failCount = report.results.filter((r) => r.status === "fail").length;
  const warnCount = report.results.filter((r) => r.status === "warn").length;

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
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={2} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Detected content type */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Detected as:</span>
          <span className="font-semibold text-gray-800">
            {CONTENT_TYPE_LABELS[report.detectedContentType] ??
              report.detectedContentType}
          </span>
          {report.contentTypeConfidence === "low" && (
            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-200">
              ⚠ Low confidence — verify this is correct
            </span>
          )}
        </div>

        {/* Score rings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-around">
            <ScoreRing score={report.overallScore} label="Overall" size={110} />
            <ScoreRing score={report.aeoScore} label="AEO Score" size={110} />
            <ScoreRing score={report.geoScore} label="GEO Score" size={110} />
          </div>

          {/* Summary counts */}
          {(failCount > 0 || warnCount > 0) && (
            <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
              {failCount > 0 && (
                <span className="text-red-600 font-medium">
                  {failCount} failing
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-yellow-600 font-medium">
                  {warnCount} needs improvement
                </span>
              )}
            </div>
          )}
        </div>

        {/* Improvement cards */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between items-start gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="underline text-red-500 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleOptimize}
          disabled={loading}
          className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Optimizing… (this may take 20–30s)" : "Optimize Article →"}
        </button>
      </main>
    </div>
  );
}
