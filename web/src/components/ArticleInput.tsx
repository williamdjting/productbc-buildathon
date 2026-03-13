"use client";

import { useState, useRef } from "react";
import BulkUrlScrape from "./BulkUrlScrape";

interface ArticleInputProps {
  onContent: (text: string) => void;
  disabled?: boolean;
}

type Tab = "paste" | "file" | "url" | "bulk";

export default function ArticleInput({ onContent, disabled }: ArticleInputProps) {
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
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={disabled}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            } disabled:opacity-50`}
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
          className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      )}

      {/* File upload */}
      {tab === "file" && (
        <div
          onClick={() => !disabled && fileRef.current?.click()}
          className={`border-2 border-dashed border-gray-300 rounded-lg p-10 text-center transition-colors ${
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:border-gray-400"
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
          <p className="text-sm text-gray-500">
            Drop a <span className="font-mono">.txt</span> or{" "}
            <span className="font-mono">.md</span> file, or click to browse
          </p>
          {text && (
            <p className="text-xs text-green-600 mt-2 font-medium">
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
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleScrape}
              disabled={disabled || urlLoading || !url.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {urlLoading ? "Fetching…" : "Fetch"}
            </button>
          </div>
          {urlError && (
            <p className="text-sm text-red-600">{urlError}</p>
          )}
          {text && !urlError && (
            <p className="text-xs text-green-600 font-medium">
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
