import { NextRequest, NextResponse } from "next/server";
import { getFirecrawlClient } from "@/lib/firecrawl";
import type { ScrapeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const firecrawl = getFirecrawlClient();
    const result = await firecrawl.scrape(body.url, {
      formats: ["markdown"],
    });

    const markdown = result.markdown ?? "";
    if (!markdown) {
      return NextResponse.json(
        { error: "Firecrawl returned no markdown content" },
        { status: 502 }
      );
    }
    return NextResponse.json({
      markdown,
      url: body.url,
    } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
