import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { buildImprovePrompt } from "@/lib/prompts";
import type { ImproveRequest, ImproveResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ImproveRequest = await req.json().catch(() => null);

  if (!body?.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!body?.report) {
    return NextResponse.json({ error: "report is required" }, { status: 400 });
  }

  try {
    const prompt = buildImprovePrompt(body.report);
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.userMessage(body.text) }],
    });

    const optimizedText = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ optimizedText } satisfies ImproveResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
