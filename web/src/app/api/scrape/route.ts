import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/jina";
import type { ScrapeRequest, ScrapeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ScrapeRequest = await req.json().catch(() => null);

  if (!body?.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic validation — only allow http/https to prevent SSRF
  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Only http and https URLs are allowed" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const markdown = await scrapeUrl(body.url);
    return NextResponse.json({ markdown } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
