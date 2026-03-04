import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawnScript } from "@/lib/spawn-script";
import { withTempDir, writeTempFile } from "@/lib/temp-files";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.oldReport || !body?.newReport) {
    return NextResponse.json(
      { error: "Both oldReport and newReport are required" },
      { status: 400 }
    );
  }

  const oldJson =
    typeof body.oldReport === "string"
      ? body.oldReport
      : JSON.stringify(body.oldReport);
  const newJson =
    typeof body.newReport === "string"
      ? body.newReport
      : JSON.stringify(body.newReport);

  try {
    const text = await withTempDir(async (dir) => {
      const oldPath = await writeTempFile(dir, "old.json", oldJson);
      const newPath = await writeTempFile(dir, "new.json", newJson);
      const outPath = path.join(dir, "comparison.txt");
      await spawnScript("compare-aeo.mjs", [oldPath, newPath, "-o", outPath]);
      return await fs.readFile(outPath, "utf8");
    });

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
