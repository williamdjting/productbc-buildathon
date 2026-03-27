"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ContentTypeSelector from "@/components/ContentTypeSelector";
import ArticleInput from "@/components/ArticleInput";
import { saveSession } from "@/lib/session";
import type { ContentTypeOrAuto, MetadataReport } from "@/lib/types";

export default function InputPage() {
  const router = useRouter();
  const [contentTypeHint, setContentTypeHint] =
    useState<ContentTypeOrAuto>("auto");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadataReport, setMetadataReport] = useState<
    MetadataReport | undefined
  >(undefined);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, contentTypeHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      saveSession({
        originalText: text,
        contentTypeHint,
        report: data.report,
        metadataReport,
      });
      router.push("/analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <StepHeader step={1} />

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-7">
        {/* Hero */}
        <div className="fade-up-1 pt-4 space-y-2">
          <h1 className="text-5xl font-extrabold text-[#ECF0F8] tracking-normal leading-none" style={{ fontFamily: "var(--font-bricolage)" }}>
            Content Ready
            <span className="text-[#00D4A8]">.</span>
          </h1>
          <p className="text-sm text-[#6B7A99] leading-relaxed">
            Analyze and optimize your content for AI search engines —{" "}
            <span className="text-[#A0AABF]">AEO + GEO</span> scoring and
            rewriting in seconds.
          </p>
        </div>

        {/* Content type selector */}
        <div className="fade-up-2">
          <ContentTypeSelector
            value={contentTypeHint}
            onChange={setContentTypeHint}
            disabled={loading}
          />
        </div>

        {/* Article input */}
        <div className="fade-up-3 space-y-1">
          <p className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">
            Your content
          </p>
          <ArticleInput
            onContent={setText}
            onMetadata={setMetadataReport}
            disabled={loading}
          />
        </div>

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
        <div className="fade-up-4">
          <button
            onClick={handleAnalyze}
            disabled={!text.trim() || loading}
            className="w-full py-3 bg-[#00D4A8] text-[#03100D] font-semibold rounded-lg hover:bg-[#00BFA0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm tracking-wide"
          >
            {loading ? "Analyzing…" : "Analyze →"}
          </button>
        </div>
      </main>
    </div>
  );
}
