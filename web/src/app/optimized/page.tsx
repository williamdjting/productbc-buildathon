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
    <div className="min-h-screen">
      <StepHeader step={3} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header row */}
        <div className="fade-up-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#ECF0F8]">
              Optimized Article
            </h2>
            <p className="text-sm text-[#6B7A99] mt-0.5">
              Rewritten to improve your AEO and GEO scores
            </p>
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => download(optimizedText, "txt")}
              className="px-4 py-2 border border-white/[0.1] bg-[#0C1018] text-[#A0AABF] text-sm rounded-lg hover:bg-[#121820] hover:text-[#D4DBE8] hover:border-white/[0.18] transition-colors"
            >
              Download .txt
            </button>
            <button
              onClick={() => download(optimizedText, "md")}
              className="px-4 py-2 border border-white/[0.1] bg-[#0C1018] text-[#A0AABF] text-sm rounded-lg hover:bg-[#121820] hover:text-[#D4DBE8] hover:border-white/[0.18] transition-colors"
            >
              Download .md
            </button>
          </div>
        </div>

        {/* Score delta banner */}
        {report && (
          <div className="fade-up-2 flex gap-6 bg-[#0C1018] border border-white/[0.07] rounded-xl px-5 py-3 text-sm">
            <span className="text-[#4A5670]">
              Pre-optimization scores —{" "}
              <span className="font-semibold text-[#D4DBE8]">
                Overall: {report.overallScore}
              </span>
              {" · "}
              <span className="font-medium text-[#00D4A8]">
                AEO: {report.aeoScore}
              </span>
              {" · "}
              <span className="font-medium text-[#A78BFA]">
                GEO: {report.geoScore}
              </span>
            </span>
          </div>
        )}

        {/* Side-by-side diff */}
        <div className="fade-up-3">
          <DiffView original={originalText} optimized={optimizedText} />
        </div>

        {/* Start over */}
        <div className="fade-up-4 flex justify-center pt-2">
          <button
            onClick={handleStartOver}
            className="text-sm text-[#4A5670] hover:text-[#A0AABF] transition-colors"
          >
            ← Start over with a new article
          </button>
        </div>
      </main>
    </div>
  );
}
