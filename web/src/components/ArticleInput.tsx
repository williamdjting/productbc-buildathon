"use client";

import { useState, useRef } from "react";
import BulkUrlScrape from "./BulkUrlScrape";

interface ArticleInputProps {
  onContent: (text: string) => void;
  onMetadata?: (report: MetadataReport) => void;
  disabled?: boolean;
}

type Tab = "paste" | "file" | "url" | "bulk";

export default function ArticleInput({
  onContent,
  onMetadata,
  disabled,
}: ArticleInputProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleTextChange(val: string) {
    setText(val);
    onContent(val);
  }

  async function handleFile(file: File) {
    const content = await file.text();
    setText(content);
    onContent(content);
  }

  async function handleScrape() {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch URL");
      setText(data.markdown);
      onContent(data.markdown);
      if (data.metadataReport) onMetadata?.(data.metadataReport);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : String(err));
    } finally {
      setUrlLoading(false);
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const TABS: { id: Tab; label: string }[] = [
    { id: "paste", label: "Paste text" },
    { id: "file", label: "Upload file" },
    { id: "url", label: "Scrape URL" },
    { id: "bulk", label: "Bulk Scrape" },
  ];

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={disabled}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[#00D4A8] text-[#00D4A8]"
                : "border-transparent text-[#6B7A99] hover:text-[#A0AABF]"
            } disabled:opacity-40`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Paste text */}
      {tab === "paste" && (
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled}
          placeholder="Paste your article here..."
          rows={12}
          className="w-full bg-[#0C1018] border border-white/[0.08] rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00D4A8]/40 focus:border-[#00D4A8]/30 text-[#D4DBE8] placeholder:text-[#3D4A60] disabled:opacity-40 transition-colors font-mono"
        />
      )}

      {/* File upload */}
      {tab === "file" && (
        <div
          onClick={() => !disabled && fileRef.current?.click()}
          className={`border-2 border-dashed border-white/[0.08] rounded-lg p-10 text-center transition-colors ${
            disabled
              ? "opacity-40 cursor-not-allowed"
              : "cursor-pointer hover:border-[#00D4A8]/30 hover:bg-[rgba(0,212,168,0.03)]"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-sm text-[#4A5670]">
            Drop a{" "}
            <span className="font-mono text-[#6B7A99]">.txt</span>{" "}or{" "}
            <span className="font-mono text-[#6B7A99]">.md</span>{" "}file, or click to browse
          </p>
          {text && (
            <p className="text-xs text-[#00D4A8] mt-2 font-medium">
              File loaded ✓
            </p>
          )}
        </div>
      )}

      {/* URL scraper */}
      {tab === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
              placeholder="https://example.com/article"
              disabled={disabled || urlLoading}
              className="flex-1 bg-[#0C1018] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00D4A8]/40 focus:border-[#00D4A8]/30 text-[#D4DBE8] placeholder:text-[#3D4A60] disabled:opacity-40 transition-colors"
            />
            <button
              onClick={handleScrape}
              disabled={disabled || urlLoading || !url.trim()}
              className="px-4 py-2 bg-[#00D4A8] text-[#03100D] text-sm font-semibold rounded-lg hover:bg-[#00BFA0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {urlLoading ? "Fetching…" : "Fetch"}
            </button>
          </div>
          {urlError && (
            <p className="text-sm text-[#F43F5E]">{urlError}</p>
          )}
          {text && !urlError && (
            <p className="text-xs text-[#00D4A8] font-medium">
              Content loaded ✓
            </p>
          )}
        </div>
      )}

      {/* Bulk URL scraper */}
      {tab === "bulk" && (
        <BulkUrlScrape onContent={onContent} disabled={disabled} />
      )}

      {/* Word count */}
      {text && tab !== "bulk" && (
        <p className="text-xs text-gray-400">
          {wordCount.toLocaleString()} words
        </p>
      )}
    </div>
  );
}
