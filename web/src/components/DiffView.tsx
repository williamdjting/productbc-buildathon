"use client";

import { useRef } from "react";

interface DiffViewProps {
  original: string;
  optimized: string;
}

export default function DiffView({ original, optimized }: DiffViewProps) {
  const leftRef = useRef<HTMLPreElement>(null);
  const rightRef = useRef<HTMLPreElement>(null);
  let isSyncing = false;

  function syncScroll(source: "left" | "right") {
    if (isSyncing) return;
    isSyncing = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
    }
    // Reset flag on next frame
    requestAnimationFrame(() => { isSyncing = false; });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Original */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Original
          </span>
          <span className="text-xs text-gray-400">
            {original.split(/\s+/).filter(Boolean).length.toLocaleString()} words
          </span>
        </div>
        <pre
          ref={leftRef}
          onScroll={() => syncScroll("left")}
          className="whitespace-pre-wrap text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-4 h-[480px] overflow-y-auto leading-relaxed text-gray-700"
        >
          {original}
        </pre>
      </div>

      {/* Optimized */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
            Optimized
          </span>
          <span className="text-xs text-gray-400">
            {optimized.split(/\s+/).filter(Boolean).length.toLocaleString()} words
          </span>
        </div>
        <pre
          ref={rightRef}
          onScroll={() => syncScroll("right")}
          className="whitespace-pre-wrap text-xs font-mono bg-green-50 border border-green-200 rounded-lg p-4 h-[480px] overflow-y-auto leading-relaxed text-gray-700"
        >
          {optimized}
        </pre>
      </div>
    </div>
  );
}
