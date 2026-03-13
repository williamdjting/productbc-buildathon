# Implementation Plan
_How to migrate the existing buildathon-project codebase to the ideal architecture._
_Read IDEAL_ARCHITECTURE_PLAN.md first for the full design rationale._

---

## Current State vs Target State

| Area | Current (buildathon) | Target |
|---|---|---|
| Pages | 1 page (`/`) with step state machine | 3 pages: `/`, `/analysis`, `/optimized` |
| LLM | OpenAI gpt-4.1-mini via raw `fetch` | Claude Sonnet 4.6 via Anthropic SDK |
| LLM invocation | `child_process.spawn` → CLI scripts → temp files | Direct Anthropic SDK calls in API routes |
| Scraping | Firecrawl (`@mendable/firecrawl-js`) | Jina AI Reader (plain `fetch`, no key) |
| Content types | None (one universal checklist) | 5 types, auto-detected by Claude |
| Scoring | 0–3 average, `not_evaluated` counted as 0 | 0–100, `na` excluded from average |
| Two scores | No (one score) | AEO score + GEO score + overall |
| Improvement suggestions | Generic reasons only | Specific actionable `suggestion` per criterion |
| State between pages | React useState (single page) | sessionStorage |
| Components | FileUploader, UrlScraper, AeoReport, ScoreGauge, RevisedArticle, CompareView | ArticleInput, ContentTypeSelector, ScoreRing, ImprovementCard, DiffView, StepHeader |
| Environment vars | `OPENAI_API_KEY`, `FIRECRAWL_API_KEY` | `ANTHROPIC_API_KEY` only |

---

## Phase Overview

```
Phase 1 — Dependencies & cleanup         (~30 min)
Phase 2 — Shared lib layer               (~1 hour)
Phase 3 — API routes                     (~1 hour)
Phase 4 — New components                 (~1.5 hours)
Phase 5 — Pages (routing + UI)           (~1.5 hours)
Phase 6 — Wiring + final cleanup         (~30 min)
```

---

## Phase 1 — Dependencies & Cleanup

### 1.1 Install Anthropic SDK

```bash
cd web
npm install @anthropic-ai/sdk
```

### 1.2 Remove Firecrawl

```bash
npm uninstall @mendable/firecrawl-js
```

### 1.3 Install shadcn/ui

shadcn/ui gives us the Button, Badge, and Card primitives used in the new components.

```bash
npx shadcn@latest init
# When prompted:
#   Style: Default
#   Base color: Slate
#   CSS variables: Yes
```

Then add the specific components we need:

```bash
npx shadcn@latest add button badge card
```

### 1.4 Update environment variables

In `web/.env.local`, replace:
```
# Remove these:
OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...

# Add this:
ANTHROPIC_API_KEY=sk-ant-...
```

### 1.5 Files to delete

These are replaced entirely by the new architecture:

```
web/src/lib/firecrawl.ts         ← replaced by jina.ts
web/src/lib/spawn-script.ts      ← subprocess bridge eliminated
web/src/lib/temp-files.ts        ← temp files eliminated
web/src/components/AeoReport.tsx ← replaced by ImprovementCard.tsx
web/src/components/ScoreGauge.tsx← replaced by ScoreRing.tsx
web/src/components/RevisedArticle.tsx ← absorbed into optimized/page.tsx
web/src/components/CompareView.tsx    ← replaced by DiffView.tsx
```

**Do not delete yet** — wait until Phase 4/5 when replacements are in place.

---

## Phase 2 — Shared Lib Layer

Create all files in `web/src/lib/`. These have no UI dependencies and can be written and tested independently.

### 2.1 `lib/types.ts` — replace existing

Delete the old content entirely and replace with:

```ts
export type ContentType = "blog" | "product" | "landing" | "howto" | "news";

export type ContentTypeOrAuto = ContentType | "auto";

export interface Criterion {
  id: string;
  category: "aeo" | "geo";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  weight: number;          // 0–1, weights within category should sum to 1
  contentTypes: ContentType[];
}

export interface CriterionResult {
  id: string;
  status: "pass" | "warn" | "fail" | "na";
  reason: string;
  evidence: string[];
  suggestion: string;      // empty string if status is "pass" or "na"
}

export interface AnalysisReport {
  detectedContentType: ContentType;
  contentTypeConfidence: "high" | "low";
  aeoScore: number;        // 0–100
  geoScore: number;        // 0–100
  overallScore: number;    // 0–100
  results: CriterionResult[];
}

export interface SessionData {
  originalText: string;
  contentTypeHint: ContentTypeOrAuto;
  report: AnalysisReport;
  optimizedText?: string;
}

// API request/response shapes
export interface ClassifyRequest {
  text: string;
  contentTypeHint?: ContentTypeOrAuto;
}

export interface ClassifyResponse {
  report: AnalysisReport;
}

export interface ImproveRequest {
  text: string;
  report: AnalysisReport;
}

export interface ImproveResponse {
  optimizedText: string;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  markdown: string;
}
```

### 2.2 `lib/anthropic.ts` — new file

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
```

### 2.3 `lib/jina.ts` — new file (replaces firecrawl.ts)

```ts
import "server-only";

export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/markdown" },
  });

  if (!response.ok) {
    throw new Error(`Jina scrape failed: ${response.status}`);
  }

  const markdown = await response.text();
  if (!markdown?.trim()) {
    throw new Error("No content returned from URL");
  }

  return markdown;
}
```

### 2.4 `lib/checklists.ts` — new file

Defines every criterion once. A function returns the right subset per content type.

```ts
import type { Criterion, ContentType } from "./types";

// ─── Shared criteria (apply to all content types) ───────────────────────────

const SHARED: Criterion[] = [
  {
    id: "direct_answer_near_top",
    category: "aeo",
    title: "Direct answer in first 60 words",
    description:
      "A clear standalone paragraph that answers the main question appears within the first 60 words of the article body.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "question_style_headings",
    category: "aeo",
    title: "Question-style headings",
    description:
      'At least two H2 or H3 headings are phrased as questions (e.g. "What is X?" or "How does Y work?").',
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "short_paragraphs_and_lists",
    category: "aeo",
    title: "Short paragraphs and bullet lists",
    description:
      "Paragraphs are 2–4 sentences. Bullet or numbered lists are used where appropriate for scannability.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "named_sources_citations",
    category: "geo",
    title: "Named sources and citations",
    description:
      'Statistics and claims are attributed to named sources (e.g. "According to Gartner..."). Vague claims without attribution are flagged.',
    impact: "high",
    weight: 0.25,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "author_and_date",
    category: "geo",
    title: "Author and publish date visible",
    description:
      "A named author and a publish/update date are present in the content. These are E-E-A-T signals.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
];

// ─── Blog-specific ───────────────────────────────────────────────────────────

const BLOG: Criterion[] = [
  {
    id: "faq_section",
    category: "aeo",
    title: "FAQ section present",
    description:
      "A dedicated FAQ or Q&A section with at least 3 questions and answers is present. Enables FAQPage schema markup.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog"],
  },
  {
    id: "concept_definitions",
    category: "aeo",
    title: "Key concepts defined",
    description:
      "Key terms and concepts are explicitly defined early in the article and used consistently throughout.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["blog"],
  },
  {
    id: "topical_depth",
    category: "geo",
    title: "Topical depth and comprehensiveness",
    description:
      "The article covers the topic in sufficient depth (800+ words) and addresses sub-questions a reader would have.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["blog"],
  },
  {
    id: "expert_attribution",
    category: "geo",
    title: "Expert attribution or original data",
    description:
      "Article includes expert quotes with full attribution, or original research/data that makes it citation-worthy.",
    impact: "medium",
    weight: 0.25,
    contentTypes: ["blog"],
  },
];

// ─── Product page-specific ───────────────────────────────────────────────────

const PRODUCT: Criterion[] = [
  {
    id: "product_schema_signals",
    category: "aeo",
    title: "Product schema signals present",
    description:
      "Content clearly states product name, key features, pricing or price range, and availability — the fields needed for Product schema markup.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["product"],
  },
  {
    id: "product_faq",
    category: "aeo",
    title: "Purchase-decision FAQ",
    description:
      "A FAQ section addresses common buyer questions: compatibility, return policy, use cases, or sizing.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["product"],
  },
  {
    id: "review_signals",
    category: "geo",
    title: "Review and rating signals",
    description:
      "Aggregate rating, review count, or customer testimonials are present and clearly attributed.",
    impact: "medium",
    weight: 0.30,
    contentTypes: ["product"],
  },
];

// ─── Landing page-specific ───────────────────────────────────────────────────

const LANDING: Criterion[] = [
  {
    id: "value_proposition_clear",
    category: "aeo",
    title: "Value proposition in first 60 words",
    description:
      "The service or offer is clearly explained within the first 60 words — what it is, who it's for, and what problem it solves.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["landing"],
  },
  {
    id: "conversion_faq",
    category: "aeo",
    title: "Conversion-focused FAQ",
    description:
      "FAQ section addresses objections and decision-stage questions: pricing, process, timeline, guarantees.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["landing"],
  },
  {
    id: "entity_consistency",
    category: "geo",
    title: "Consistent entity identity",
    description:
      "Company name, description, and service claims are consistent throughout. No contradictions that would confuse AI entity resolution.",
    impact: "medium",
    weight: 0.30,
    contentTypes: ["landing"],
  },
];

// ─── How-to guide-specific ───────────────────────────────────────────────────

const HOWTO: Criterion[] = [
  {
    id: "numbered_steps",
    category: "aeo",
    title: "Numbered steps present",
    description:
      "Instructions are formatted as a numbered list. Each step is a self-contained sentence or short paragraph.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["howto"],
  },
  {
    id: "tools_time_callout",
    category: "aeo",
    title: "Tools, materials, or time estimate called out",
    description:
      "Required tools, materials, prerequisites, or estimated completion time are explicitly stated — ideally near the top.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["howto"],
  },
  {
    id: "howto_faq",
    category: "aeo",
    title: "FAQ covering common mistakes or variations",
    description:
      "A FAQ or troubleshooting section addresses common problems, variations, or follow-up questions.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["howto"],
  },
];

// ─── News / editorial-specific ───────────────────────────────────────────────

const NEWS: Criterion[] = [
  {
    id: "news_freshness",
    category: "geo",
    title: "Publish date and freshness signals",
    description:
      "Article has a visible publish or last-updated date. For time-sensitive topics, the date is prominently displayed.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["news"],
  },
  {
    id: "named_sources_quotes",
    category: "geo",
    title: "Named sources with direct quotes",
    description:
      "At least one named person or organisation is quoted directly. Anonymous sources are flagged as weaker GEO signals.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["news"],
  },
  {
    id: "news_article_schema_signals",
    category: "aeo",
    title: "NewsArticle schema signals",
    description:
      "Content includes a clear headline, byline, dateline, and organisation name — the fields needed for NewsArticle schema.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["news"],
  },
];

// ─── Lookup map ───────────────────────────────────────────────────────────────

const TYPE_CRITERIA: Record<ContentType, Criterion[]> = {
  blog: BLOG,
  product: PRODUCT,
  landing: LANDING,
  howto: HOWTO,
  news: NEWS,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full criteria list for a given content type.
 * Shared criteria come first, then type-specific criteria.
 */
export function getCriteria(contentType: ContentType): Criterion[] {
  return [...SHARED, ...TYPE_CRITERIA[contentType]];
}

/**
 * Returns ALL criteria across all types — used in the classify prompt
 * so Claude can evaluate after detecting the content type.
 */
export function getAllCriteria(): Criterion[] {
  const seen = new Set<string>();
  const all: Criterion[] = [];
  for (const list of [SHARED, ...Object.values(TYPE_CRITERIA)]) {
    for (const c of list) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        all.push(c);
      }
    }
  }
  return all;
}
```

### 2.5 `lib/score.ts` — new file (replaces the calcScore in classify/route.ts)

```ts
import type { Criterion, CriterionResult } from "./types";

const STATUS_WEIGHT = { pass: 1, warn: 0.5, fail: 0, na: null } as const;

/**
 * Calculates AEO score, GEO score, and overall score (all 0–100).
 * "na" criteria are excluded from the average entirely.
 */
export function calcScores(
  results: CriterionResult[],
  criteria: Criterion[]
): { aeoScore: number; geoScore: number; overallScore: number } {
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

  let aeoWeightedSum = 0, aeoTotalWeight = 0;
  let geoWeightedSum = 0, geoTotalWeight = 0;

  for (const result of results) {
    if (result.status === "na") continue;           // excluded from average
    const criterion = criteriaMap.get(result.id);
    if (!criterion) continue;

    const scoreMultiplier = STATUS_WEIGHT[result.status];
    const contribution = criterion.weight * scoreMultiplier;

    if (criterion.category === "aeo") {
      aeoWeightedSum += contribution;
      aeoTotalWeight += criterion.weight;
    } else {
      geoWeightedSum += contribution;
      geoTotalWeight += criterion.weight;
    }
  }

  const aeoScore = aeoTotalWeight > 0
    ? Math.round((aeoWeightedSum / aeoTotalWeight) * 100)
    : 0;
  const geoScore = geoTotalWeight > 0
    ? Math.round((geoWeightedSum / geoTotalWeight) * 100)
    : 0;

  // Overall = 60% AEO + 40% GEO
  const overallScore = Math.round(aeoScore * 0.6 + geoScore * 0.4);

  return { aeoScore, geoScore, overallScore };
}
```

### 2.6 `lib/prompts.ts` — new file

Keeps all prompt strings in one place. Easy to iterate on without touching business logic.

```ts
import { getAllCriteria } from "./checklists";
import type { AnalysisReport, ContentTypeOrAuto } from "./types";

export function buildClassifyPrompt(contentTypeHint?: ContentTypeOrAuto): {
  system: string;
  user: (text: string) => string;
} {
  const criteria = getAllCriteria();

  const criteriaBlock = criteria
    .map(
      (c) =>
        `- id: "${c.id}" | category: ${c.category} | impact: ${c.impact} | applies to: ${c.contentTypes.join(", ")}\n  ${c.title}: ${c.description}`
    )
    .join("\n\n");

  const hintLine =
    contentTypeHint && contentTypeHint !== "auto"
      ? `The user believes this is a "${contentTypeHint}" page. Treat this as a strong hint but correct it if the content clearly does not match.`
      : `No content type has been specified. Determine it from the content.`;

  const system = `You are an expert in AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization).

STEP 1 — Identify the content type. Choose one of: blog | product | landing | howto | news
Use these signals:
- blog: educational/informational, no pricing, opinion or analysis, long-form
- product: pricing, features, availability, buy or cart CTA
- landing: service offering, lead-gen CTA ("get a quote", "sign up"), company/brand focus
- howto: numbered steps, tools or materials list, "how to" in the title or headings
- news: dateline, event-based, named source quotes, published date prominent

${hintLine}

STEP 2 — Evaluate the article against the criteria below.
For each criterion, return:
- status: "pass" | "warn" | "fail" | "na"
  Use "na" ONLY if the criterion does not apply to the detected content type.
- reason: one sentence explaining the verdict
- evidence: array of 1–3 short direct quotes or line references from the article
- suggestion: one specific actionable fix (empty string if status is "pass" or "na")

CRITERIA:
${criteriaBlock}

Return ONLY valid JSON in this exact shape:
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

No markdown. No commentary. Only the JSON object.`;

  return {
    system,
    user: (text: string) => `Article to evaluate:\n---\n${text}\n---`,
  };
}

export function buildImprovePrompt(report: AnalysisReport): {
  system: string;
  user: (text: string) => string;
} {
  // Only send the failing/warning items — not the full JSON report
  const issues = report.results
    .filter((r) => r.status === "warn" || r.status === "fail")
    .map((r) => `- ${r.id}: ${r.suggestion}`)
    .join("\n");

  const system = `You are an expert AEO/GEO content editor.
Rewrite the article to fix the issues listed below.
Rules:
- Preserve the author's voice, tone, and meaning
- Only add or change what is needed to address the issues
- Do NOT shorten or summarise the article
- Output ONLY the revised article text — no preamble, no commentary, no "Here is the revised version"
- Start directly with the article title or first heading`;

  return {
    system,
    user: (text: string) =>
      `Issues to fix:\n${issues}\n\nOriginal article:\n---\n${text}\n---`,
  };
}
```

### 2.7 `lib/session.ts` — new file (client-side only)

```ts
import type { SessionData } from "./types";

const KEY = "aeo_session";

export function saveSession(data: SessionData): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function loadSession(): SessionData | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function updateSession(patch: Partial<SessionData>): void {
  const existing = loadSession();
  if (!existing) return;
  saveSession({ ...existing, ...patch });
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
```

---

## Phase 3 — API Routes

All three routes follow the same simple pattern: parse request → call lib function → return JSON. No subprocess, no temp files.

### 3.1 Rewrite `api/classify/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { buildClassifyPrompt } from "@/lib/prompts";
import { getAllCriteria } from "@/lib/checklists";
import { calcScores } from "@/lib/score";
import type { ClassifyRequest, ClassifyResponse, AnalysisReport } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ClassifyRequest = await req.json().catch(() => null);
  if (!body?.text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const prompt = buildClassifyPrompt(body.contentTypeHint);
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user(body.text) }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const parsed = JSON.parse(raw);

    const criteria = getAllCriteria();
    const { aeoScore, geoScore, overallScore } = calcScores(parsed.results, criteria);

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
```

### 3.2 Rewrite `api/improve/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { buildImprovePrompt } from "@/lib/prompts";
import type { ImproveRequest, ImproveResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ImproveRequest = await req.json().catch(() => null);
  if (!body?.text || !body?.report) {
    return NextResponse.json({ error: "text and report are required" }, { status: 400 });
  }

  try {
    const prompt = buildImprovePrompt(body.report);
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user(body.text) }],
    });

    const optimizedText = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ optimizedText } satisfies ImproveResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 3.3 Rewrite `api/scrape/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/jina";
import type { ScrapeRequest, ScrapeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: ScrapeRequest = await req.json().catch(() => null);
  if (!body?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const markdown = await scrapeUrl(body.url);
    return NextResponse.json({ markdown } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 3.4 Delete `api/compare/route.ts`

The compare step is now done client-side on the analysis page using the data already in sessionStorage. No API call needed.

---

## Phase 4 — New Components

All components go in `web/src/components/`. Write each as a standalone file. They should not import from each other.

### 4.1 `StepHeader.tsx` — new

Sticky top bar showing current step and a back button.

```tsx
"use client";
import { useRouter } from "next/navigation";

interface StepHeaderProps {
  step: 1 | 2 | 3;
  onBack?: () => void;
}

export default function StepHeader({ step, onBack }: StepHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) { onBack(); return; }
    router.back();
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {step > 1 ? (
        <button onClick={handleBack} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Back
        </button>
      ) : (
        <div />
      )}
      <p className="text-sm font-medium text-gray-500">Step {step} of 3</p>
      <div />
    </div>
  );
}
```

### 4.2 `ContentTypeSelector.tsx` — new

Radio-button group for content type. "Auto-detect" is selected by default.

```tsx
"use client";
import type { ContentTypeOrAuto } from "@/lib/types";

const OPTIONS: { value: ContentTypeOrAuto; label: string; description: string }[] = [
  { value: "auto", label: "Auto-detect", description: "Recommended — Claude will identify the type" },
  { value: "blog", label: "Blog post", description: "Educational content, thought leadership" },
  { value: "product", label: "Product page", description: "Ecommerce, SaaS features" },
  { value: "landing", label: "Landing page", description: "Marketing, lead gen, services" },
  { value: "howto", label: "How-to guide", description: "Tutorials, step-by-step instructions" },
  { value: "news", label: "News / editorial", description: "Journalism, press releases" },
];

interface ContentTypeSelectorProps {
  value: ContentTypeOrAuto;
  onChange: (value: ContentTypeOrAuto) => void;
  disabled?: boolean;
}

export default function ContentTypeSelector({ value, onChange, disabled }: ContentTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Content type</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex flex-col gap-0.5 border rounded-lg p-3 cursor-pointer transition-colors ${
              value === opt.value
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              type="radio"
              className="sr-only"
              name="contentType"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
            />
            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
            <span className="text-xs text-gray-500">{opt.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

### 4.3 `ArticleInput.tsx` — new (replaces FileUploader + UrlScraper combined)

Three tabs on one component: paste text, upload file, scrape URL.

```tsx
"use client";
import { useState, useRef } from "react";

interface ArticleInputProps {
  onContent: (text: string) => void;
  disabled?: boolean;
}

type InputTab = "paste" | "file" | "url";

export default function ArticleInput({ onContent, disabled }: ArticleInputProps) {
  const [tab, setTab] = useState<InputTab>("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleTextChange(val: string) {
    setText(val);
    onContent(val);
  }

  async function handleFile(file: File) {
    const content = await file.text();
    setText(content);
    onContent(content);
  }

  async function handleScrape() {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      setText(data.markdown);
      onContent(data.markdown);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : String(err));
    } finally {
      setUrlLoading(false);
    }
  }

  const tabs: { id: InputTab; label: string }[] = [
    { id: "paste", label: "Paste text" },
    { id: "file", label: "Upload file" },
    { id: "url", label: "Scrape URL" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={disabled}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "paste" && (
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled}
          placeholder="Paste your article here..."
          rows={12}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      )}

      {tab === "file" && (
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <p className="text-sm text-gray-500">Drop a .txt or .md file, or click to browse</p>
          {text && <p className="text-xs text-green-600 mt-2 font-medium">File loaded ✓</p>}
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
              placeholder="https://example.com/article"
              disabled={disabled || urlLoading}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleScrape}
              disabled={disabled || urlLoading || !url.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {urlLoading ? "Fetching…" : "Fetch"}
            </button>
          </div>
          {urlError && <p className="text-sm text-red-600">{urlError}</p>}
          {text && !urlError && <p className="text-xs text-green-600 font-medium">Content loaded ✓</p>}
        </div>
      )}

      {text && (
        <p className="text-xs text-gray-400">
          {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words
        </p>
      )}
    </div>
  );
}
```

### 4.4 `ScoreRing.tsx` — new (replaces ScoreGauge.tsx)

SVG circular progress ring. 0–100 score. No external library.

```tsx
interface ScoreRingProps {
  score: number;    // 0–100
  label: string;
  size?: number;    // px, default 100
}

export default function ScoreRing({ score, label, size = 100 }: ScoreRingProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const fill = Math.min(score, 100) / 100;
  const strokeDashoffset = circumference * (1 - fill);

  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
      <p className="text-xs text-gray-500 font-medium text-center">{label}</p>
    </div>
  );
}
```

### 4.5 `ImprovementCard.tsx` — new (replaces AeoReport.tsx)

One card per criterion result.

```tsx
import type { CriterionResult, Criterion } from "@/lib/types";

const STATUS_CONFIG = {
  pass: { icon: "✓", class: "text-green-600 bg-green-50 border-green-200" },
  warn: { icon: "⚠", class: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  fail: { icon: "✗", class: "text-red-600 bg-red-50 border-red-200" },
  na:   { icon: "–", class: "text-gray-400 bg-gray-50 border-gray-200" },
};

const IMPACT_BADGE = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-gray-100 text-gray-600",
};

interface ImprovementCardProps {
  result: CriterionResult;
  criterion: Criterion;
}

export default function ImprovementCard({ result, criterion }: ImprovementCardProps) {
  const cfg = STATUS_CONFIG[result.status];

  return (
    <div className={`border rounded-lg p-4 space-y-2 ${cfg.class}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">{cfg.icon}</span>
          <p className="text-sm font-semibold text-gray-800">{criterion.title}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_BADGE[criterion.impact]}`}>
            {criterion.impact}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
            {criterion.category.toUpperCase()}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-600">{result.reason}</p>

      {result.evidence.length > 0 && (
        <ul className="space-y-0.5">
          {result.evidence.map((e, i) => (
            <li key={i} className="text-xs font-mono bg-white bg-opacity-60 rounded px-2 py-1">
              {e}
            </li>
          ))}
        </ul>
      )}

      {result.suggestion && (
        <div className="text-xs text-gray-700 bg-white bg-opacity-70 rounded px-3 py-2 border border-current border-opacity-20">
          <span className="font-semibold">Fix: </span>{result.suggestion}
        </div>
      )}
    </div>
  );
}
```

### 4.6 `DiffView.tsx` — new (replaces CompareView.tsx)

Side-by-side synchronized scrolling. No library needed.

```tsx
"use client";
import { useRef } from "react";

interface DiffViewProps {
  original: string;
  optimized: string;
}

export default function DiffView({ original, optimized }: DiffViewProps) {
  const leftRef = useRef<HTMLPreElement>(null);
  const rightRef = useRef<HTMLPreElement>(null);

  function syncScroll(source: "left" | "right") {
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to   = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) to.scrollTop = from.scrollTop;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Original</p>
        <pre
          ref={leftRef}
          onScroll={() => syncScroll("left")}
          className="whitespace-pre-wrap text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto leading-relaxed"
        >
          {original}
        </pre>
      </div>
      <div>
        <p className="text-xs font-semibold text-green-600 mb-1 uppercase tracking-wide">Optimized</p>
        <pre
          ref={rightRef}
          onScroll={() => syncScroll("right")}
          className="whitespace-pre-wrap text-xs font-mono bg-green-50 border border-green-200 rounded-lg p-4 h-96 overflow-y-auto leading-relaxed"
        >
          {optimized}
        </pre>
      </div>
    </div>
  );
}
```

---

## Phase 5 — Pages

### 5.1 Rewrite `app/page.tsx` — Input page

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ContentTypeSelector from "@/components/ContentTypeSelector";
import ArticleInput from "@/components/ArticleInput";
import { saveSession } from "@/lib/session";
import type { ContentTypeOrAuto } from "@/lib/types";

export default function InputPage() {
  const router = useRouter();
  const [contentTypeHint, setContentTypeHint] = useState<ContentTypeOrAuto>("auto");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, contentTypeHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      saveSession({ originalText: text, contentTypeHint, report: data.report });
      router.push("/analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={1} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Article Optimizer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze and improve your content for AEO and GEO
          </p>
        </div>

        <ContentTypeSelector
          value={contentTypeHint}
          onChange={setContentTypeHint}
          disabled={loading}
        />

        <ArticleInput onContent={setText} disabled={loading} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!text.trim() || loading}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing…" : "Analyze →"}
        </button>
      </main>
    </div>
  );
}
```

### 5.2 Create `app/analysis/page.tsx` — new file

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import ScoreRing from "@/components/ScoreRing";
import ImprovementCard from "@/components/ImprovementCard";
import { loadSession, updateSession } from "@/lib/session";
import { getAllCriteria } from "@/lib/checklists";
import type { SessionData } from "@/lib/types";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "Blog Post", product: "Product Page",
  landing: "Landing Page", howto: "How-to Guide", news: "News / Editorial",
};

export default function AnalysisPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  if (!session) return null;

  const { report, originalText } = session;
  const criteria = getAllCriteria();
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

  // Sort: fail first, then warn, then pass, then na
  const ORDER = { fail: 0, warn: 1, pass: 2, na: 3 };
  const sortedResults = [...report.results].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status]
  );

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText, report }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Optimization failed");
      updateSession({ optimizedText: data.optimizedText });
      router.push("/optimized");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={2} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Content type badge */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Detected as:</span>
          <span className="font-semibold text-gray-800">
            {CONTENT_TYPE_LABELS[report.detectedContentType] ?? report.detectedContentType}
          </span>
          {report.contentTypeConfidence === "low" && (
            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              Low confidence — verify this
            </span>
          )}
        </div>

        {/* Score rings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-around">
            <ScoreRing score={report.overallScore} label="Overall" size={110} />
            <ScoreRing score={report.aeoScore} label="AEO Score" size={110} />
            <ScoreRing score={report.geoScore} label="GEO Score" size={110} />
          </div>
        </div>

        {/* Improvement cards */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Criteria breakdown</h2>
          {sortedResults.map((result) => {
            const criterion = criteriaMap.get(result.id);
            if (!criterion) return null;
            return (
              <ImprovementCard key={result.id} result={result} criterion={criterion} />
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleOptimize}
          disabled={loading}
          className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Optimizing…" : "Optimize Article →"}
        </button>
      </main>
    </div>
  );
}
```

### 5.3 Create `app/optimized/page.tsx` — new file

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/StepHeader";
import DiffView from "@/components/DiffView";
import { loadSession, clearSession } from "@/lib/session";
import type { SessionData } from "@/lib/types";

export default function OptimizedPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s?.optimizedText) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  if (!session?.optimizedText) return null;

  function download(content: string, ext: "txt" | "md") {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `optimized-article.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleStartOver() {
    clearSession();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StepHeader step={3} />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Optimized Article</h2>
            <p className="text-sm text-gray-500">Your article has been rewritten for AEO and GEO</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => download(session.optimizedText!, "txt")}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Download .txt
            </button>
            <button
              onClick={() => download(session.optimizedText!, "md")}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Download .md
            </button>
          </div>
        </div>

        <DiffView original={session.originalText} optimized={session.optimizedText} />

        <button
          onClick={handleStartOver}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Start over with a new article
        </button>
      </main>
    </div>
  );
}
```

---

## Phase 6 — Wiring & Final Cleanup

### 6.1 Create the analysis and optimized route directories

```bash
mkdir -p web/src/app/analysis web/src/app/optimized
```

The page.tsx files from Phase 5 go into these directories.

### 6.2 Delete old files (now safe to remove)

```bash
# Old lib files
rm web/src/lib/firecrawl.ts
rm web/src/lib/spawn-script.ts
rm web/src/lib/temp-files.ts

# Old components (replaced in Phase 4)
rm web/src/components/AeoReport.tsx
rm web/src/components/ScoreGauge.tsx
rm web/src/components/RevisedArticle.tsx
rm web/src/components/CompareView.tsx

# Old CLI output files (no longer used by the web app)
# Keep the .mjs scripts themselves — they still work as standalone CLI tools
```

### 6.3 Update `next.config.ts`

No changes needed — App Router handles the new routes automatically.

### 6.4 Smoke test checklist

- [ ] `npm run dev` starts without errors
- [ ] `/` loads, content type selector defaults to "Auto-detect"
- [ ] Paste some text → click Analyze → redirects to `/analysis`
- [ ] `/analysis` shows three score rings + improvement cards
- [ ] Low-confidence detection shows the yellow badge
- [ ] Click "Optimize Article" → redirects to `/optimized`
- [ ] `/optimized` shows side-by-side diff
- [ ] Download .txt works
- [ ] Download .md works
- [ ] "Start over" clears session and returns to `/`
- [ ] Navigating directly to `/analysis` with empty sessionStorage redirects to `/`
- [ ] URL scrape tab fetches content via Jina

---

## File Change Summary

| File | Action |
|---|---|
| `web/src/lib/types.ts` | Rewrite |
| `web/src/lib/anthropic.ts` | New |
| `web/src/lib/jina.ts` | New |
| `web/src/lib/checklists.ts` | New |
| `web/src/lib/prompts.ts` | New |
| `web/src/lib/score.ts` | New |
| `web/src/lib/session.ts` | New |
| `web/src/lib/firecrawl.ts` | Delete |
| `web/src/lib/spawn-script.ts` | Delete |
| `web/src/lib/temp-files.ts` | Delete |
| `web/src/app/api/classify/route.ts` | Rewrite |
| `web/src/app/api/improve/route.ts` | Rewrite |
| `web/src/app/api/scrape/route.ts` | Rewrite |
| `web/src/app/api/compare/route.ts` | Delete |
| `web/src/app/page.tsx` | Rewrite |
| `web/src/app/analysis/page.tsx` | New |
| `web/src/app/optimized/page.tsx` | New |
| `web/src/components/StepHeader.tsx` | New |
| `web/src/components/ContentTypeSelector.tsx` | New |
| `web/src/components/ArticleInput.tsx` | New |
| `web/src/components/ScoreRing.tsx` | New |
| `web/src/components/ImprovementCard.tsx` | New |
| `web/src/components/DiffView.tsx` | New |
| `web/src/components/AeoReport.tsx` | Delete |
| `web/src/components/ScoreGauge.tsx` | Delete |
| `web/src/components/RevisedArticle.tsx` | Delete |
| `web/src/components/CompareView.tsx` | Delete |
| `web/src/components/FileUploader.tsx` | Delete |
| `web/src/components/UrlScraper.tsx` | Delete |
| `web/.env.local` | Update keys |
| `web/package.json` | Remove firecrawl, add @anthropic-ai/sdk |

---

## What Is NOT Changed

- `next.config.ts` — no changes needed
- `web/tsconfig.json` — no changes needed
- `web/postcss.config.mjs` — no changes needed
- `tailwind.config.ts` — shadcn/ui init will update this automatically
- The root `.mjs` CLI scripts — still work independently as before
