import { NextRequest, NextResponse } from "next/server";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/crawl`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? "";
  const limit = searchParams.get("limit") ?? "100";

  const url = new URL(`${CF_BASE}/${jobId}`);
  if (cursor) url.searchParams.set("cursor", cursor);
  url.searchParams.set("limit", limit);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.errors?.[0]?.message ?? "Cloudflare error" },
      { status: res.status }
    );
  }

  const result = data?.result ?? data;
  // Cloudflare returns records[] with { url, status, metadata: { status: httpStatus } }
  const urls = (result.records ?? []).map((r: { url: string; status: string; metadata?: { status?: number } }) => ({
    url: r.url,
    status: r.status,
    httpStatus: r.metadata?.status ?? null,
  }));
  return NextResponse.json({
    jobId,
    jobStatus: result.status ?? result.jobStatus,
    total: result.total ?? 0,
    finished: result.finished ?? 0,
    browserSecondsUsed: result.browserSecondsUsed ?? 0,
    cursor: result.cursor ?? null,
    urls,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const res = await fetch(`${CF_BASE}/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.errors?.[0]?.message ?? "Cloudflare error" },
      { status: res.status }
    );
  }

  return NextResponse.json({ jobId, cancelled: true });
}
