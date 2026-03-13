"use client";

import { useState, useRef } from "react";

interface BulkUrlScrapeProps {
  onContent: (text: string) => void;
  disabled?: boolean;
}

interface CrawledUrl {
  url: string;
  status: string;
  httpStatus: number | null;
}

type JobStatus = "idle" | "starting" | "running" | "completed" | "errored" | "cancelled";

const TERMINAL_STATUSES = new Set(["completed", "errored", "cancelled_by_user", "cancelled_due_to_timeout", "cancelled_due_to_limits"]);

export default function BulkUrlScrape({ onContent, disabled }: BulkUrlScrapeProps) {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(100);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [urls, setUrls] = useState<CrawledUrl[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollStatus(id: string, cursor?: string) {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/crawl/status/${id}?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Poll failed");

      setTotal(data.total ?? 0);
      setFinished(data.finished ?? 0);
      setUrls((prev) => {
        const existing = new Set(prev.map((u) => u.url));
        const newUrls = (data.urls as CrawledUrl[]).filter((u) => !existing.has(u.url));
        return [...prev, ...newUrls];
      });

      const cfStatus: string = data.jobStatus ?? "";

      if (TERMINAL_STATUSES.has(cfStatus)) {
        if (data.cursor) {
          await pollStatus(id, data.cursor);
        } else {
          setJobStatus(cfStatus.startsWith("cancelled") ? "cancelled" : cfStatus as JobStatus);
          stopPolling();
        }
      } else {
        if (data.cursor) {
          await pollStatus(id, data.cursor);
        } else {
          pollRef.current = setTimeout(() => pollStatus(id), 5000);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setJobStatus("errored");
      stopPolling();
    }
  }

  async function handleAnalyze() {
    if (!url.trim()) return;
    stopPolling();
    setError(null);
    setUrls([]);
    setSelected(new Set());
    setTotal(0);
    setFinished(0);
    setJobId(null);
    setJobStatus("starting");

    try {
      const res = await fetch("/api/crawl/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start crawl");

      setJobId(data.jobId);
      setJobStatus("running");
      pollRef.current = setTimeout(() => pollStatus(data.jobId), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setJobStatus("errored");
    }
  }

  async function handleCancel() {
    if (!jobId) return;
    stopPolling();
    await fetch(`/api/crawl/status/${jobId}`, { method: "DELETE" }).catch(() => {});
    setJobStatus("cancelled");
  }

  const completedUrls = urls.filter((u) => u.status === "completed");
  const isRunning = jobStatus === "running" || jobStatus === "starting";
  const allSelected = completedUrls.length > 0 && completedUrls.every((u) => selected.has(u.url));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(completedUrls.map((u) => u.url)));
    }
  }

  function toggleOne(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function handleUseSelected() {
    const toUse = someSelected
      ? completedUrls.filter((u) => selected.has(u.url)).map((u) => u.url)
      : completedUrls.map((u) => u.url);
    onContent(toUse.join("\n"));
  }

  return (
    <div className="space-y-3">
      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isRunning && handleAnalyze()}
          placeholder="https://example.com"
          disabled={disabled || isRunning}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value))))}
          disabled={disabled || isRunning}
          title="Max pages to crawl"
          className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <span className="self-center text-xs text-gray-400 shrink-0">limit</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={disabled || isRunning || !url.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {jobStatus === "starting" ? "Starting…" : isRunning ? "Crawling…" : "Analyze"}
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress */}
      {(isRunning || jobStatus === "completed") && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          {isRunning && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          <span>
            {jobStatus === "completed"
              ? `Done — ${total} URLs discovered, ${completedUrls.length} crawled`
              : `Crawling… ${finished}/${total || "?"} pages processed`}
          </span>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Cancelled */}
      {jobStatus === "cancelled" && (
        <p className="text-xs text-amber-600">Crawl cancelled — {completedUrls.length} URLs collected so far</p>
      )}

      {/* Results list */}
      {urls.length > 0 && (
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded accent-blue-600"
              />
              <span className="text-xs text-gray-600">
                {someSelected
                  ? `${selected.size} of ${completedUrls.length} selected`
                  : `${completedUrls.length} URL${completedUrls.length !== 1 ? "s" : ""} found`}
                {urls.length !== completedUrls.length &&
                  ` · ${urls.length - completedUrls.length} skipped`}
              </span>
            </label>
            {completedUrls.length > 0 && (
              <button
                onClick={handleUseSelected}
                className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                {someSelected ? `Use ${selected.size} selected` : "Use all"}
              </button>
            )}
          </div>

          {/* URL list */}
          <ul className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 text-xs">
            {urls.map((u, i) => {
              const isCompleted = u.status === "completed";
              const isChecked = selected.has(u.url);
              return (
                <li
                  key={i}
                  onClick={() => isCompleted && toggleOne(u.url)}
                  className={`flex items-center gap-2 px-3 py-1.5 ${isCompleted ? "cursor-pointer hover:bg-gray-50" : ""} ${isChecked ? "bg-blue-50" : ""}`}
                >
                  {isCompleted ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(u.url)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 shrink-0 rounded accent-blue-600"
                    />
                  ) : (
                    <span className={u.status === "errored" ? "text-red-400 shrink-0" : "text-gray-300 shrink-0"}>
                      {u.status === "errored" ? "✗" : "○"}
                    </span>
                  )}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-blue-600 hover:underline"
                  >
                    {u.url}
                  </a>
                  {u.httpStatus && (
                    <span className="ml-auto shrink-0 text-gray-400">{u.httpStatus}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
