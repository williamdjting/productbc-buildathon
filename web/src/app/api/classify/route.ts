import { NextRequest, NextResponse } from "next/server";
import { spawnScript } from "@/lib/spawn-script";
import { withTempDir, writeTempFile } from "@/lib/temp-files";
import type { AeoReport, ClassifyResponse } from "@/lib/types";

const STATUS_SCORE: Record<string, number> = {
  yes: 3,
  partial: 2,
  no: 1,
  not_evaluated: 0,
};

function flattenStatuses(obj: unknown): number[] {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  const results: number[] = [];
  if ("status" in o && typeof o.status === "string") {
    const val = STATUS_SCORE[o.status];
    if (val !== undefined) results.push(val);
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === "status" || k === "reason" || k === "evidence") continue;
    results.push(...flattenStatuses(v));
  }
  return results;
}

function calcScore(report: AeoReport): number {
  const statuses = flattenStatuses(report.aeo_checklist_evaluation);
  if (statuses.length === 0) return 0;
  const sum = statuses.reduce((a, b) => a + b, 0);
  return parseFloat((sum / statuses.length).toFixed(2));
}

export async function POST(req: NextRequest) {
  let text: string;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    text = await (file as File).text();
  } else {
    const body = await req.json().catch(() => null);
    if (!body?.text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    text = body.text;
  }

  try {
    const result = await withTempDir(async (dir) => {
      const articlePath = await writeTempFile(dir, "article.txt", text);
      const stdout = await spawnScript("classify-aeo.mjs", [articlePath]);
      return stdout;
    });

    const report: AeoReport = JSON.parse(result);
    const score = calcScore(report);
    return NextResponse.json({ report, score } satisfies ClassifyResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
