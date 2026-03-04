import { NextRequest, NextResponse } from "next/server";
import { spawnScript } from "@/lib/spawn-script";
import { withTempDir, writeTempFile } from "@/lib/temp-files";
import type { ImproveResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  let reportJson: string;
  let articleText: string;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const reportFile = form.get("report");
    const articleFile = form.get("article");
    if (!reportFile || !articleFile) {
      return NextResponse.json(
        { error: "Both report and article are required" },
        { status: 400 }
      );
    }
    reportJson =
      typeof reportFile === "string"
        ? reportFile
        : await (reportFile as File).text();
    articleText =
      typeof articleFile === "string"
        ? articleFile
        : await (articleFile as File).text();
  } else {
    const body = await req.json().catch(() => null);
    if (!body?.report || !body?.articleText) {
      return NextResponse.json(
        { error: "Both report and articleText are required" },
        { status: 400 }
      );
    }
    reportJson =
      typeof body.report === "string"
        ? body.report
        : JSON.stringify(body.report);
    articleText = body.articleText;
  }

  try {
    const revisedText = await withTempDir(async (dir) => {
      const jsonPath = await writeTempFile(dir, "report.json", reportJson);
      const articlePath = await writeTempFile(dir, "article.txt", articleText);
      const stdout = await spawnScript("improve-aeo.mjs", [
        jsonPath,
        articlePath,
      ]);
      return stdout.trim();
    });

    return NextResponse.json({ revisedText } satisfies ImproveResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
