"use client";

import { useState } from "react";
import FileUploader from "@/components/FileUploader";
import UrlScraper from "@/components/UrlScraper";
import AeoReportView from "@/components/AeoReport";
import ScoreGauge from "@/components/ScoreGauge";
import RevisedArticle from "@/components/RevisedArticle";
import CompareView from "@/components/CompareView";
import type { AeoReport } from "@/lib/types";

type Step =
  | "input"
  | "classifying"
  | "classified"
  | "improving"
  | "improved"
  | "reclassifying"
  | "done";

interface ClassifyResult {
  report: AeoReport;
  score: number;
}

function SectionCard({
  title,
  children,
  step,
}: {
  title: string;
  children: React.ReactNode;
  step?: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        {step !== undefined && (
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {step}
          </span>
        )}
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg
        className="animate-spin h-4 w-4 text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8z"
        />
      </svg>
      Processing…
    </div>
  );
}

export default function Home() {
  const [articleText, setArticleText] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [inputMode, setInputMode] = useState<"file" | "url">("file");

  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);

  const [originalResult, setOriginalResult] = useState<ClassifyResult | null>(null);
  const [revisedText, setRevisedText] = useState<string | null>(null);
  const [revisedResult, setRevisedResult] = useState<ClassifyResult | null>(null);
  const [compareText, setCompareText] = useState<string | null>(null);

  function reset() {
    setArticleText(null);
    setSourceLabel("");
    setStep("input");
    setError(null);
    setOriginalResult(null);
    setRevisedText(null);
    setRevisedResult(null);
    setCompareText(null);
  }

  async function classify(text: string): Promise<ClassifyResult> {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Classification failed");
    return data as ClassifyResult;
  }

  async function handleClassify() {
    if (!articleText) return;
    setError(null);
    setStep("classifying");
    try {
      const result = await classify(articleText);
      setOriginalResult(result);
      setStep("classified");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("input");
    }
  }

  async function handleImprove() {
    if (!articleText || !originalResult) return;
    setError(null);
    setStep("improving");
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: originalResult.report, articleText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Improvement failed");
      setRevisedText(data.revisedText);
      setStep("improved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("classified");
    }
  }

  async function handleReclassify() {
    if (!revisedText || !originalResult) return;
    setError(null);
    setStep("reclassifying");
    try {
      const revised = await classify(revisedText);
      setRevisedResult(revised);

      const cmpRes = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldReport: originalResult.report,
          newReport: revised.report,
        }),
      });
      const cmpData = await cmpRes.json();
      if (!cmpRes.ok) throw new Error(cmpData.error ?? "Compare failed");
      setCompareText(cmpData.text);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("improved");
    }
  }

  const busy =
    step === "classifying" ||
    step === "improving" ||
    step === "reclassifying";

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">AEO Toolkit</h1>
          <p className="text-sm text-gray-500">
            Answer Engine Optimization — classify, improve, and compare articles
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between items-start gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="underline text-red-600 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Input */}
        <SectionCard title="Article Input" step={1}>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["file", "url"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={`text-xs px-3 py-1.5 rounded-md border ${
                    inputMode === mode
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {mode === "file" ? "Upload file" : "Scrape URL"}
                </button>
              ))}
            </div>

            {inputMode === "file" ? (
              <FileUploader
                disabled={busy}
                onContent={(text, name) => {
                  setArticleText(text);
                  setSourceLabel(name);
                }}
              />
            ) : (
              <UrlScraper
                disabled={busy}
                onMarkdown={(markdown, url) => {
                  setArticleText(markdown);
                  setSourceLabel(url);
                }}
              />
            )}

            {articleText && (
              <p className="text-xs text-gray-500">
                Loaded:{" "}
                <span className="font-medium text-gray-700">{sourceLabel}</span>{" "}
                ({articleText.length.toLocaleString()} chars)
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleClassify}
                disabled={!articleText || busy}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Classify
              </button>
              {(originalResult || revisedText) && (
                <button
                  onClick={reset}
                  disabled={busy}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Reset
                </button>
              )}
            </div>

            {step === "classifying" && <Spinner />}
          </div>
        </SectionCard>

        {/* Step 2: Classification */}
        {originalResult && (
          <SectionCard title="AEO Classification" step={2}>
            <div className="space-y-4">
              <ScoreGauge score={originalResult.score} label="AEO Score" />
              <AeoReportView report={originalResult.report} />
              <button
                onClick={handleImprove}
                disabled={busy}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Improve Article
              </button>
              {step === "improving" && <Spinner />}
            </div>
          </SectionCard>
        )}

        {/* Step 3: Revised article */}
        {revisedText && (
          <SectionCard title="Revised Article" step={3}>
            <div className="space-y-4">
              <RevisedArticle text={revisedText} />
              <button
                onClick={handleReclassify}
                disabled={busy}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Re-classify &amp; Compare
              </button>
              {step === "reclassifying" && <Spinner />}
            </div>
          </SectionCard>
        )}

        {/* Step 4: Revised classification */}
        {revisedResult && (
          <SectionCard title="Revised AEO Classification" step={4}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ScoreGauge
                  score={originalResult!.score}
                  label="Original score"
                />
                <ScoreGauge score={revisedResult.score} label="Revised score" />
              </div>
              <AeoReportView report={revisedResult.report} />
            </div>
          </SectionCard>
        )}

        {/* Step 5: Comparison */}
        {compareText && (
          <SectionCard title="Comparison" step={5}>
            <CompareView text={compareText} />
          </SectionCard>
        )}
      </div>
    </main>
  );
}
