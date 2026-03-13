"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ContentTypeSelector from "@/components/ContentTypeSelector";
import ArticleInput from "@/components/ArticleInput";
import { saveSession } from "@/lib/session";
import type { ContentTypeOrAuto } from "@/lib/types";

export default function InputPage() {
  const router = useRouter();
  const [contentTypeHint, setContentTypeHint] =
    useState<ContentTypeOrAuto>("auto");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      saveSession({ originalText: text, contentTypeHint, report: data.report });
      router.push("/analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={1} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Article Optimizer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze and improve your content for AEO and GEO
          </p>
        </div>

        {/* Content type selector */}
        <ContentTypeSelector
          value={contentTypeHint}
          onChange={setContentTypeHint}
          disabled={loading}
        />

        {/* Article input — paste / upload / URL */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Your content</p>
          <ArticleInput onContent={setText} disabled={loading} />
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
          onClick={handleAnalyze}
          disabled={!text.trim() || loading}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyzing…" : "Analyze →"}
        </button>
      </main>
    </div>
  );
}
