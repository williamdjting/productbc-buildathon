import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { buildClassifyPrompt } from "@/lib/prompts";
import { getAllCriteria } from "@/lib/checklists";
import { calcScores } from "@/lib/score";
import type {
  ClassifyRequest,
  ClassifyResponse,
  AnalysisReport,
  CriterionResult,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ClassifyRequest = await req.json().catch(() => null);

  if (!body?.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const prompt = buildClassifyPrompt(body.contentTypeHint);
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.userMessage(body.text) }],
    });

    // Claude returns plain text — strip markdown code fences if present
    const rawText = (message.content[0] as { text: string }).text.trim();
    const jsonText = rawText.startsWith("```")
      ? rawText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : rawText;

    const parsed = JSON.parse(jsonText) as {
      detectedContentType: AnalysisReport["detectedContentType"];
      contentTypeConfidence: AnalysisReport["contentTypeConfidence"];
      results: CriterionResult[];
    };

    // Calculate scores from the results using all criteria definitions
    const allCriteria = getAllCriteria();
    const { aeoScore, geoScore, overallScore } = calcScores(
      parsed.results,
      allCriteria
    );

    const report: AnalysisReport = {
      detectedContentType: parsed.detectedContentType,
      contentTypeConfidence: parsed.contentTypeConfidence,
      aeoScore,
      geoScore,
      overallScore,
      results: parsed.results,
    };

    return NextResponse.json({ report } satisfies ClassifyResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
