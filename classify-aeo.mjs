#!/usr/bin/env node

// Simple CLI tool to classify a markdown article against an AEO checklist
// using an LLM and output a structured JSON object.

import fs from "node:fs/promises";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("ERROR: Please set the OPENAI_API_KEY environment variable.");
    process.exit(1);
  }

  const [, , inputPath] = process.argv;

  if (!inputPath) {
    console.error("Usage: node classify-aeo.mjs <path-to-markdown-file>");
    process.exit(1);
  }

  let markdown;
  try {
    markdown = await fs.readFile(inputPath, "utf8");
  } catch (err) {
    console.error(`ERROR: Unable to read file at '${inputPath}':`, err.message);
    process.exit(1);
  }

  const systemPrompt = `
You are an expert in Answer Engine Optimization (AEO) and content structure.
Your task is to CLASSIFY the given markdown article against the AEO checklist only.
Do NOT summarize, paraphrase, or condense the article. Do NOT include article body text in the output.
Output ONLY structured classification data: for each criterion, set status, a short reason, and evidence as brief citations (e.g. line references or short direct quotes). Evidence must point to specific places in the source, not restate or summarize content.

AEO checklist criteria:
1) One-paragraph answer near the top (40-80 words) that cleanly answers the main question.
2) Question-style headings present (e.g., "What is AEO?").
3) FAQ or HowTo schema or clearly marked FAQ/HowTo section present.
4) Definitions of key concepts are consistent throughout.
5) Page is fast, readable, and accessible (as far as can be inferred from markdown content).

Allowed status values: "yes", "no", "partial", "not_evaluated".

Return ONLY valid JSON. No markdown, no comments, no article summaries.
  `.trim();

  const userPrompt = `
Classify the article below into the AEO checklist schema. Do NOT summarize the article. Only output the structured classification (status, reason, evidence per criterion). Evidence = brief citations (e.g. "L16: '## What is AEO?'") or short quotes only.

Return JSON with this exact structure:
{
  "schema_version": "aeo-checklist-v1",
  "article": {
    "title": string | null,
    "date": string | null,
    "author": string | null,
    "tags": string[] | null
  },
  "aeo_checklist_evaluation": {
    "one_paragraph_answer_near_top": {
      "status": "yes" | "no" | "partial" | "not_evaluated",
      "reason": string,
      "evidence": string[]
    },
    "question_style_headings_present": {
      "status": "yes" | "no" | "partial" | "not_evaluated",
      "reason": string,
      "evidence": string[]
    },
    "faq_or_howto_schema_present": {
      "status": "yes" | "no" | "partial" | "not_evaluated",
      "reason": string,
      "evidence": string[]
    },
    "definitions_consistent": {
      "status": "yes" | "no" | "partial" | "not_evaluated",
      "reason": string,
      "evidence": string[]
    },
    "page_fast_readable_accessible": {
      "fast_page": {
        "status": "yes" | "no" | "partial" | "not_evaluated",
        "reason": string
      },
      "readable": {
        "status": "yes" | "no" | "partial" | "not_evaluated",
        "reason": string,
        "evidence": string[]
      },
      "accessible": {
        "status": "yes" | "no" | "partial" | "not_evaluated",
        "reason": string,
        "evidence": string[]
      }
    }
  }
}

For "article", copy only literal metadata from frontmatter (title, date, author, tags) if present; use null when not available. Do not summarize or add content from the article body.

Markdown article to classify:
---
${markdown}
---
  `.trim();

  const body = {
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
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
    console.error(
      `ERROR: OpenAI API responded with status ${response.status}: ${text}`
    );
    process.exit(1);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    console.error("ERROR: No content returned from OpenAI API.");
    process.exit(1);
  }

  // Best-effort sanity check: ensure it's valid JSON before printing.
  try {
    const parsed = JSON.parse(content);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    // If parsing fails, just print raw content to help debugging.
    console.log(content);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

