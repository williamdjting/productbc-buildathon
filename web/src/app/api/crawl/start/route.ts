import { NextRequest, NextResponse } from "next/server";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/crawl`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let rawUrl: string = body.url.trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    rawUrl = "https://" + rawUrl;
  }

  try {
    new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const payload = {
    url: rawUrl,
    limit: body.limit ?? 100,
    depth: body.depth ?? 3,
    source: body.source ?? "all",
    render: false,
    options: {
      includeSubdomains: true,
    },
  };

  const res = await fetch(CF_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CF_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.errors?.[0]?.message ?? "Cloudflare error" },
      { status: res.status }
    );
  }

  // Cloudflare returns { success: true, result: "<jobId>" }
  const jobId = typeof data?.result === "string" ? data.result : (data?.result?.id ?? data?.id);
  return NextResponse.json({ jobId, config: payload });
}
