#!/usr/bin/env node

// Reads an AEO report JSON + original article, uses an LLM to suggest changes,
// and outputs a revised article you can re-run through classify-aeo.mjs.

import fs from "node:fs/promises";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("ERROR: Please set the OPENAI_API_KEY environment variable.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const outIdx = args.indexOf("-o");
  const hasOut = outIdx !== -1;
  const outPath = hasOut ? args[outIdx + 1] : null;
  const rest = hasOut ? args.slice(0, outIdx).concat(args.slice(outIdx + 2)) : args;
  const [jsonPath, articlePath] = rest;

  if (!jsonPath || !articlePath) {
    console.error("Usage: node improve-aeo.mjs <aeo-report.json> <article.txt|.md> [-o <output-path>]");
    console.error("  If -o is omitted, revised article is printed to stdout.");
    process.exit(1);
  }

  let reportJson;
  let article;
  try {
    const [jsonRaw, articleRaw] = await Promise.all([
      fs.readFile(jsonPath, "utf8"),
      fs.readFile(articlePath, "utf8")
    ]);
    reportJson = JSON.parse(jsonRaw);
    article = articleRaw;
  } catch (err) {
    console.error("ERROR reading files:", err.message);
    process.exit(1);
  }

  const eval_ = reportJson?.aeo_checklist_evaluation;
  if (!eval_) {
    console.error("ERROR: AEO report must contain aeo_checklist_evaluation.");
    process.exit(1);
  }

  // Build a short summary of what to improve (status "no" or "partial" only).
  const toImprove = [];
  const flatten = (obj, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    if (obj.status && (obj.status === "no" || obj.status === "partial")) {
      toImprove.push({ key: prefix, status: obj.status, reason: obj.reason || "" });
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === "evidence" || k === "status" || k === "reason") continue;
      flatten(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  flatten(eval_);

  const reportSummary =
    toImprove.length > 0
      ? toImprove.map(({ key, status, reason }) => `- ${key}: ${status} — ${reason}`).join("\n")
      : "All criteria are yes or not_evaluated; only minor polish if needed.";

  const systemPrompt = `
You are an expert in Answer Engine Optimization (AEO). You will receive:
1) An AEO report (classification) for an article.
2) The full original article (markdown or plain text).

Your task: produce a REVISED version of the article that addresses the criteria that scored "no" or "partial" in the report. Preserve the article's meaning, tone, and structure wherever possible. Only add or change what is needed to satisfy the AEO checklist:

- One-paragraph answer near the top (40–80 words) that cleanly answers the main question.
- Question-style headings where appropriate (e.g., "What is X?").
- FAQ or HowTo section (or clear structure that could be marked up with schema).
- Consistent definitions for key concepts.
- Readable, scannable structure (headings, lists, short paragraphs where helpful).

Do NOT summarize or shorten the article. Output ONLY the revised article text—no preamble, no "Here is the revised version", no explanation. Start directly with the article content (title or first heading).
  `.trim();

  const userPrompt = `
AEO report summary (criteria to improve):
${reportSummary}

Full AEO report (for reference):
${JSON.stringify(reportJson, null, 2)}

Original article:
---
${article}
---

Output the revised article only (no commentary). Preserve frontmatter if the original had it.
  `.trim();

  const body = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("ERROR: Failed to call OpenAI API:", err.message);
    process.exit(1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`ERROR: OpenAI API responded with status ${response.status}: ${text}`);
    process.exit(1);
  }

  const data = await response.json();
  const revised = data?.choices?.[0]?.message?.content?.trim?.();
  if (!revised) {
    console.error("ERROR: No content returned from OpenAI API.");
    process.exit(1);
  }

  if (outPath) {
    await fs.writeFile(outPath, revised, "utf8");
    console.error(`Wrote revised article to ${outPath}`);
  } else {
    console.log(revised);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
