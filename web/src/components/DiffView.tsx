"use client";

import { useMemo, useState } from "react";

// ─── Diff algorithm (LCS-based line diff) ─────────────────────────────────────

type DiffOp =
  | { type: "equal"; line: string }
  | { type: "insert"; line: string }
  | { type: "delete"; line: string };

function diffLines(oldText: string, newText: string): DiffOp[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build ops
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: "equal", line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "insert", line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: "delete", line: oldLines[i - 1] });
      i--;
    }
  }
  return ops;
}

// ─── Context collapsing ────────────────────────────────────────────────────────

const CONTEXT = 3;

type HunkLine = { kind: "line"; op: DiffOp };
type HunkCollapsed = { kind: "collapsed"; count: number; opsStart: number };
type HunkItem = HunkLine | HunkCollapsed;

function buildHunks(ops: DiffOp[]): HunkItem[] {
  // Mark indices that should be visible (changed lines + context)
  const visible = new Set<number>();
  ops.forEach((op, i) => {
    if (op.type !== "equal") {
      for (
        let c = Math.max(0, i - CONTEXT);
        c <= Math.min(ops.length - 1, i + CONTEXT);
        c++
      ) {
        visible.add(c);
      }
    }
  });

  const result: HunkItem[] = [];
  let i = 0;
  while (i < ops.length) {
    if (visible.has(i)) {
      result.push({ kind: "line", op: ops[i] });
      i++;
    } else {
      const start = i;
      while (i < ops.length && !visible.has(i)) i++;
      result.push({ kind: "collapsed", count: i - start, opsStart: start });
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DiffViewProps {
  original: string;
  optimized: string;
}

export default function DiffView({ original, optimized }: DiffViewProps) {
  const ops = useMemo(() => diffLines(original, optimized), [original, optimized]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const additions = ops.filter((o) => o.type === "insert").length;
  const deletions = ops.filter((o) => o.type === "delete").length;

  const hunks = useMemo(() => buildHunks(ops), [ops]);

  function toggleExpand(opsStart: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(opsStart)) next.delete(opsStart);
      else next.add(opsStart);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-[#00D4A8] font-semibold">+{additions} additions</span>
        <span className="text-rose-400 font-semibold">−{deletions} deletions</span>
        <span className="text-[#3D4A60] ml-auto">
          {original.split(/\s+/).filter(Boolean).length.toLocaleString()} →{" "}
          {optimized.split(/\s+/).filter(Boolean).length.toLocaleString()} words
        </span>
      </div>

      {/* Diff area */}
      <div className="bg-[#0C1018] border border-white/[0.07] rounded-lg overflow-hidden">
        <div className="overflow-y-auto max-h-[600px] text-xs font-mono leading-relaxed">
          {hunks.map((item, idx) => {
            if (item.kind === "collapsed") {
              const isExpanded = expanded.has(item.opsStart);
              if (isExpanded) {
                // Render the hidden equal lines
                const equalOps = ops.slice(
                  item.opsStart,
                  item.opsStart + item.count
                );
                return (
                  <div key={idx}>
                    {equalOps.map((op, li) => (
                      <div
                        key={li}
                        className="flex px-4 py-px text-[#3D4A60] hover:bg-white/[0.02]"
                      >
                        <span className="w-4 flex-shrink-0 select-none opacity-40">
                          {" "}
                        </span>
                        <span className="whitespace-pre-wrap break-all">
                          {op.line || "\u00A0"}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => toggleExpand(item.opsStart)}
                      className="w-full text-left px-4 py-1.5 text-[#4A5670] hover:text-[#6B7A99] hover:bg-white/[0.02] transition-colors border-y border-white/[0.04]"
                    >
                      ↑ Collapse {item.count} unchanged lines
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={idx}
                  onClick={() => toggleExpand(item.opsStart)}
                  className="w-full text-left px-4 py-1.5 text-[#4A5670] hover:text-[#6B7A99] hover:bg-white/[0.02] transition-colors border-y border-white/[0.04]"
                >
                  ⋯ {item.count} unchanged lines
                </button>
              );
            }

            const { op } = item;

            if (op.type === "insert") {
              return (
                <div
                  key={idx}
                  className="flex px-4 py-px bg-[rgba(0,212,168,0.07)] border-l-2 border-[#00D4A8]"
                >
                  <span className="w-4 flex-shrink-0 select-none text-[#00D4A8] font-bold">
                    +
                  </span>
                  <span className="whitespace-pre-wrap break-all text-[#A8D8CE]">
                    {op.line || "\u00A0"}
                  </span>
                </div>
              );
            }

            if (op.type === "delete") {
              return (
                <div
                  key={idx}
                  className="flex px-4 py-px bg-rose-500/[0.07] border-l-2 border-rose-500"
                >
                  <span className="w-4 flex-shrink-0 select-none text-rose-400 font-bold">
                    −
                  </span>
                  <span className="whitespace-pre-wrap break-all text-rose-300/70 line-through decoration-rose-500/40">
                    {op.line || "\u00A0"}
                  </span>
                </div>
              );
            }

            // equal
            return (
              <div
                key={idx}
                className="flex px-4 py-px text-[#4A5670] hover:bg-white/[0.02]"
              >
                <span className="w-4 flex-shrink-0 select-none opacity-30">
                  {" "}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {op.line || "\u00A0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
