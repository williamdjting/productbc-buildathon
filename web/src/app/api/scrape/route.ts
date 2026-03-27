import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/jina";
import { fetchAndGradeMetadata } from "@/lib/metadata";
import type { ScrapeRequest, ScrapeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ScrapeRequest = await req.json().catch(() => null);

  if (!body?.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic validation — only allow http/https to prevent SSRF
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only http and https URLs are allowed" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Run Jina scrape and metadata fetch in parallel — metadata failure is non-fatal
    const [markdownResult, metadataResult] = await Promise.allSettled([
      scrapeUrl(body.url),
      fetchAndGradeMetadata(parsedUrl.href),
    ]);

    if (markdownResult.status === "rejected") {
      throw markdownResult.reason;
    }

    return NextResponse.json({
      markdown: markdownResult.value,
      metadataReport:
        metadataResult.status === "fulfilled" ? metadataResult.value : undefined,
    } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
