import { getAllCriteria } from "./checklists";
import type { AnalysisReport, ContentTypeOrAuto } from "./types";

// ─── Classify prompt ──────────────────────────────────────────────────────────

/**
 * Builds the system prompt and a user message factory for the classify call.
 *
 * Claude does two things in one call:
 *   1. Detects the content type from the article
 *   2. Evaluates it against the criteria for that type
 *
 * This avoids a two-round-trip approach and keeps the logic simple.
 */
export function buildClassifyPrompt(hint?: ContentTypeOrAuto): {
  system: string;
  userMessage: (text: string) => string;
} {
  const criteria = getAllCriteria();

  // Build a readable criteria block for the prompt
  const criteriaBlock = criteria
    .map(
      (c) =>
        `- id: "${c.id}" | category: ${c.category.toUpperCase()} | impact: ${c.impact} | applies to: ${c.contentTypes.join(", ")}\n  ${c.title}: ${c.description}`
    )
    .join("\n\n");

  const hintLine =
    hint && hint !== "auto"
      ? `The user believes this is a "${hint}" page. Treat this as a strong signal but correct it if the content clearly does not match.`
      : `No content type has been specified. Determine it from the content alone.`;

  const system = `You are an expert in AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization).

Your job has two steps. Complete both in one response.

STEP 1 — Identify the content type.
Choose exactly one of: blog | product | landing | howto | news

Use these signals:
- blog: educational or informational, no pricing, opinion or analysis, long-form
- product: pricing, product features, availability, buy or cart CTA
- landing: service offering, lead-gen CTA ("get a quote", "sign up"), company or brand focus
- howto: numbered steps, tools or materials list, "how to" appears in title or headings
- news: dateline, event-based, named source quotes, published date prominent

${hintLine}

STEP 2 — Evaluate the article against the criteria below.
For each criterion:
- If the criterion applies to the detected content type: evaluate it and return pass, warn, or fail
- If the criterion does NOT apply to the detected content type: return "na"
- "na" means not applicable — it will be excluded from the score entirely

For each criterion return:
- status: "pass" | "warn" | "fail" | "na"
- reason: one sentence explaining your verdict
- evidence: array of 1–3 short direct quotes from the article (empty array if na or no evidence found)
- suggestion: one specific, actionable fix the writer should make (empty string if status is pass or na)

CRITERIA:
${criteriaBlock}

Return ONLY a valid JSON object in this exact shape. No markdown. No commentary. No explanation outside the JSON.

{
  "detectedContentType": "blog" | "product" | "landing" | "howto" | "news",
  "contentTypeConfidence": "high" | "low",
  "results": [
    {
      "id": "criterion_id",
      "status": "pass" | "warn" | "fail" | "na",
      "reason": "...",
      "evidence": ["...", "..."],
      "suggestion": "..."
    }
  ]
}

Use "low" confidence only if the content is genuinely ambiguous between two types.`;

  return {
    system,
    userMessage: (text: string) =>
      `Article to evaluate:\n---\n${text}\n---`,
  };
}

// ─── Improve prompt ───────────────────────────────────────────────────────────

/**
 * Builds the system prompt and a user message factory for the improve call.
 *
 * Only sends the failing/warning criteria suggestions to Claude —
 * NOT the full JSON report. This keeps the prompt lean and focused.
 */
export function buildImprovePrompt(report: AnalysisReport): {
  system: string;
  userMessage: (text: string) => string;
} {
  const issues = report.results
    .filter((r) => r.status === "warn" || r.status === "fail")
    .map((r) => `- [${r.status.toUpperCase()}] ${r.id}: ${r.suggestion}`)
    .join("\n");

  const issueCount = report.results.filter(
    (r) => r.status === "warn" || r.status === "fail"
  ).length;

  const system = `You are an expert AEO and GEO content editor.
Your job is to rewrite the article below to fix the ${issueCount} issue${issueCount === 1 ? "" : "s"} listed.

Rules:
- Preserve the author's voice, tone, and meaning throughout
- Only add or change what is needed to address the listed issues
- Do NOT shorten or summarise the article
- Do NOT add a preamble like "Here is the revised version:" — start directly with the article
- Output ONLY the revised article text

Issues to fix:
${issues}`;

  return {
    system,
    userMessage: (text: string) =>
      `Original article:\n---\n${text}\n---`,
  };
}
