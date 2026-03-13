"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import DiffView from "@/components/DiffView";
import { loadSession, clearSession } from "@/lib/session";
import type { SessionData } from "@/lib/types";

export default function OptimizedPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s?.optimizedText) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  if (!session?.optimizedText) return null;

  function download(content: string, ext: "txt" | "md") {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `optimized-article.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleStartOver() {
    clearSession();
    router.push("/");
  }

  const { originalText, optimizedText, report } = session;

  return (
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={3} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Optimized Article
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Rewritten to improve your AEO and GEO scores
            </p>
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => download(optimizedText, "txt")}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Download .txt
            </button>
            <button
              onClick={() => download(optimizedText, "md")}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Download .md
            </button>
          </div>
        </div>

        {/* Score delta banner */}
        {report && (
          <div className="flex gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm">
            <span className="text-gray-500">
              Pre-optimization scores —{" "}
              <span className="font-semibold text-gray-800">
                Overall: {report.overallScore}
              </span>
              {" · "}
              <span className="font-medium text-blue-700">
                AEO: {report.aeoScore}
              </span>
              {" · "}
              <span className="font-medium text-purple-700">
                GEO: {report.geoScore}
              </span>
            </span>
          </div>
        )}

        {/* Side-by-side diff */}
        <DiffView original={originalText} optimized={optimizedText} />

        {/* Start over */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleStartOver}
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            ← Start over with a new article
          </button>
        </div>
      </main>
    </div>
  );
}
