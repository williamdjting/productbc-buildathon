# Ideal Architecture Plan — Article Optimizer Studio
_Designed from scratch. Implementation against existing codebase is a separate step._

---

## What We Are Building

A 3-page web tool that lets users paste text, upload a file, or enter a URL, then:
1. **Input page** — enter content + choose content type
2. **Analysis page** — see AEO score, GEO score, what is failing, and specific recommended fixes
3. **Optimized page** — see the AI-rewritten version in a side-by-side diff, then download as `.txt` or `.md`

---

## AEO vs GEO — The Two Scores Explained

We surface two separate scores because they measure different things:

| | AEO (Answer Engine Optimization) | GEO (Generative Engine Optimization) |
|---|---|---|
| **What it is** | Optimizing for AI to *extract* your content as a direct answer | Optimizing for AI to *cite* your content in a generated response |
| **Who uses this** | Google AI Overviews, voice assistants, Bing Copilot snippets | ChatGPT, Perplexity, Gemini when writing a response |
| **Key signals** | Direct answer near top, question headings, FAQ structure, definitions | Authority signals, citations, expert attribution, structured data, off-site mentions |
| **Quick test** | "Would a chatbot paste this paragraph as a direct answer?" | "Would a chatbot footnote this page as a source?" |

In practice they overlap and reinforce each other. We score both, show both, and optimize for both.

---

## Content Types

The checklist criteria change based on what kind of page is being optimized.
We support five types in v1:

| Type | Primary Schema | Best For |
|---|---|---|
| **Blog post** | Article + FAQPage | Educational content, thought leadership, long-form articles |
| **Product page** | Product + Offer + AggregateRating | Ecommerce, SaaS feature pages |
| **Landing page** | Organization + Service + FAQPage | Marketing pages, lead gen, service pages |
| **How-to guide** | HowTo + FAQPage | Tutorials, step-by-step instructions, recipes |
| **News / editorial** | NewsArticle + Author | Journalism, press releases, event-based reporting |

Each type has its own checklist (different criteria, different weights). Shared criteria like "direct answer near top" and "question-style headings" apply to all types.

### How the Content Type Is Determined

**The user does not have to select the type upfront.** Claude auto-detects it as part of the classify call.

The input page shows:
```
Content Type:  ◉ Auto-detect (recommended)
               ○ Blog post  ○ Product page  ○ Landing page  ○ How-to guide  ○ News/editorial
```

The classify prompt instructs Claude to:
1. First identify the content type using these signals:
   - `blog` — educational/informational, no pricing, opinion or analysis, long-form
   - `product` — pricing, SKU, features, buy/cart CTA, availability
   - `landing` — service offering, lead-gen CTA ("get a quote", "sign up"), company/brand focus
   - `howto` — numbered steps, tools/materials list, "how to" in title or headings
   - `news` — dateline, event-based, named source quotes, published date prominent
2. Then evaluate against the criteria for that detected type
3. Return the detected type and a confidence level alongside the results

If the user pre-selected a type, the prompt treats it as a strong hint: "The user believes this is a [type]. Confirm or correct this."

The analysis page shows: **"Detected as: Blog Post [Change ↓]"** — if the user disagrees they change it and re-run classify. One extra click, no friction for the common case.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 App Router** | File-based routing, API routes built in, TypeScript first |
| Language | **TypeScript** | Type safety across pages, API, and shared types |
| Styling | **Tailwind CSS** | Already in project, fast to build with |
| Components | **shadcn/ui** | Accessible, unstyled components — matches what Lovable used |
| LLM | **Claude Sonnet 4.6** | Best instruction following, 200K context, superior writing quality |
| URL scraping | **Jina AI Reader** | Free, no API key, returns clean markdown, zero dependencies |
| State between pages | **sessionStorage** | Simple, no library needed, data survives navigation but not refresh |

**No subprocess spawning. No temp files. No Firecrawl. No gpt-4.1-mini.**
All LLM calls go directly through the Anthropic SDK in API routes.

---

## File Structure

```
web/src/
├── app/
│   ├── page.tsx                    ← Step 1: Input page (/)
│   ├── analysis/
│   │   └── page.tsx                ← Step 2: Analysis page (/analysis)
│   ├── optimized/
│   │   └── page.tsx                ← Step 3: Optimized + diff + download (/optimized)
│   └── api/
│       ├── classify/route.ts       ← POST { text, contentType } → AnalysisResult
│       ├── improve/route.ts        ← POST { report, text } → { optimizedText }
│       └── scrape/route.ts         ← POST { url } → { markdown }
│
├── components/
│   ├── StepHeader.tsx              ← Sticky "Step 1 of 3" header with back nav
│   ├── ArticleInput.tsx            ← Tabbed: textarea / file upload / URL input
│   ├── ContentTypeSelector.tsx     ← Blog / Product / Landing / How-to selector
│   ├── ScoreRing.tsx               ← Circular SVG progress ring (0–100)
│   ├── ImprovementCard.tsx         ← One failing/warning criterion with fix suggestion
│   └── DiffView.tsx                ← Side-by-side original vs optimized
│
└── lib/
    ├── types.ts                    ← All TypeScript interfaces (single source of truth)
    ├── anthropic.ts                ← Anthropic client singleton (server-only)
    ├── jina.ts                     ← Jina scraper helper (server-only)
    ├── checklists.ts               ← Criteria definitions per content type
    ├── prompts.ts                  ← Prompt builders for classify and improve
    ├── score.ts                    ← Score calculation logic (fixed, 0–100)
    └── session.ts                  ← sessionStorage read/write helpers (client-only)
```

---

## TypeScript Interfaces (`lib/types.ts`)

```ts
// Content types we support
export type ContentType = "blog" | "product" | "landing" | "howto" | "news";

// A single evaluation criterion
export interface Criterion {
  id: string;
  category: "aeo" | "geo";
  title: string;                           // "Direct answer near top"
  description: string;                     // What this checks
  impact: "high" | "medium" | "low";
  weight: number;                          // Scoring weight (0–1, sums to 1 per category)
  contentTypes: ContentType[];             // Which content types this applies to
}

// The LLM's verdict on one criterion
export interface CriterionResult {
  id: string;
  status: "pass" | "warn" | "fail" | "na"; // na = not applicable to this content type
  reason: string;                           // Why this status was given
  evidence: string[];                       // Short quotes or line refs from the article
  suggestion: string;                       // Specific fix: "Add a 40-60 word summary..."
}

// Full analysis report
export interface AnalysisReport {
  detectedContentType: ContentType;        // what Claude determined the content type to be
  contentTypeConfidence: "high" | "low";   // low = warn user the detection may be off
  aeoScore: number;                        // 0–100
  geoScore: number;                        // 0–100
  overallScore: number;                    // 0–100 (weighted average)
  results: CriterionResult[];
}

// What gets stored in sessionStorage
export interface SessionData {
  originalText: string;
  contentTypeHint: ContentType | "auto";   // "auto" means user left it on auto-detect
  report: AnalysisReport;
  optimizedText?: string;
}
```

---

## Checklist System (`lib/checklists.ts`)

One file. A map of content type → array of applicable criteria IDs. Criteria defined once, reused across types.

```ts
// Shared criteria apply to all content types
const SHARED_CRITERIA: Criterion[] = [
  {
    id: "direct_answer_near_top",
    category: "aeo",
    title: "Direct answer in first 60 words",
    description: "A clear, standalone paragraph answering the main question appears near the top",
    impact: "high",
    weight: 0.25,
    contentTypes: ["blog", "product", "landing", "howto"],
  },
  {
    id: "question_headings",
    category: "aeo",
    title: "Question-style headings",
    description: "H2/H3 headings phrased as questions (e.g. 'What is X?' or 'How does Y work?')",
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog", "product", "landing", "howto"],
  },
  // ... more shared criteria
];

// Content-type-specific criteria
const BLOG_CRITERIA: Criterion[] = [
  {
    id: "faq_section",
    category: "aeo",
    title: "FAQ section with FAQPage schema",
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog"],
    // ...
  },
  // ...
];

// Single export: get criteria for a content type
export function getCriteria(contentType: ContentType): Criterion[] {
  return [...SHARED_CRITERIA, ...TYPE_CRITERIA[contentType]];
}
```

---

## Scoring (`lib/score.ts`)

Rules:
- `na` criteria are **excluded** from the average (not counted as 0)
- `pass` = full weight, `warn` = half weight, `fail` = 0
- AEO score and GEO score calculated separately from their respective criteria
- Overall = 60% AEO + 40% GEO (AEO is the core use case)
- All scores are 0–100

```ts
export function calcScores(results: CriterionResult[], criteria: Criterion[]) {
  // Filter out na, calculate weighted average per category
  // Returns { aeoScore, geoScore, overallScore }
}
```

---

## API Routes

### `POST /api/scrape`
```
Input:  { url: string }
Output: { markdown: string }
```
Calls `https://r.jina.ai/{url}` with `Accept: text/markdown`. No API key needed. Returns clean markdown.

### `POST /api/classify`
```
Input:  { text: string, contentTypeHint?: ContentType }  ← hint is optional
Output: { report: AnalysisReport }
```
1. If `contentTypeHint` provided, passes it to the prompt as a hint
2. Builds the classify prompt — Claude detects the type AND evaluates in one call
3. Calls Claude Sonnet 4.6 with structured output (JSON mode)
4. Parses response into `AnalysisReport` (includes `detectedContentType`)
5. Calculates AEO/GEO/overall scores via `score.ts`
6. Returns the report

### `POST /api/improve`
```
Input:  { text: string, report: AnalysisReport }
Output: { optimizedText: string }
```
1. Filters report to only failing/warning criteria
2. Builds the improve prompt with the original text + specific failures + suggestions
3. Calls Claude Sonnet 4.6 (plain text output, not JSON)
4. Returns the rewritten article text only

---

## Page Flow & State

State is passed between pages via sessionStorage. Simple and no library needed.

```
[/] Input Page
  User enters text / uploads file / pastes URL
  User optionally selects content type (default: auto-detect)
  Click "Analyze" → POST /api/classify { text, contentTypeHint? }
  On success → save to sessionStorage → router.push("/analysis")

[/analysis] Analysis Page
  On mount → read sessionStorage
  If empty → redirect back to /
  Show: AEO score ring + GEO score ring + overall score ring
  Show: ImprovementCard list (fail first, then warn, then pass)
  Each card shows: criterion title, status badge, reason, evidence, specific suggestion
  Click "Optimize Article" → POST /api/improve
  On success → save optimizedText to sessionStorage → router.push("/optimized")

[/optimized] Optimized Page
  On mount → read sessionStorage
  If empty → redirect back to /
  Show: DiffView (original left, optimized right)
  Show: DownloadButtons (Download .txt, Download .md)
  Click "Start Over" → clear sessionStorage → router.push("/")
```

---

## Page Designs

### Step 1 — Input Page (`/`)
```
┌─────────────────────────────────────┐
│  Article Optimizer                  │
│  Step 1 of 3                        │
├─────────────────────────────────────┤
│  Content Type                       │
│  ◉ Auto-detect                      │
│  ○ Blog  ○ Product  ○ Landing       │
│  ○ How-to  ○ News/Editorial         │
├─────────────────────────────────────┤
│  Your Content                       │
│  [Paste text] [Upload file] [URL]   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Paste your article here...  │  │
│  └───────────────────────────────┘  │
│  1,243 words                        │
│                                     │
│  [Analyze →]                        │
└─────────────────────────────────────┘
```

### Step 2 — Analysis Page (`/analysis`)
```
┌─────────────────────────────────────┐
│  ← Back   Step 2 of 3              │
├─────────────────────────────────────┤
│  Detected as: Blog Post  [Change ↓] │  ← shown when auto-detect was used
│  ⚠ Low confidence — verify type    │  ← shown only when confidence: "low"
├─────────────────────────────────────┤
│   ○ 72        ○ 58        ○ 67     │
│  Overall    AEO Score   GEO Score  │
├─────────────────────────────────────┤
│  What needs fixing                  │
│                                     │
│  ✗ [HIGH] Direct answer near top   │
│    Missing. Add a 40–60 word para  │
│    at the top that directly answers │
│    your main question.              │
│                                     │
│  ⚠ [MED] Question-style headings   │
│    Only 1 found. Rephrase at least  │
│    3 headings as questions.         │
│                                     │
│  ✓ [HIGH] FAQ section present      │
│    Found "FAQs" at line 45.         │
│                                     │
│  [Optimize Article →]               │
└─────────────────────────────────────┘
```

### Step 3 — Optimized Page (`/optimized`)
```
┌─────────────────────────────────────┐
│  ← Back   Step 3 of 3              │
├─────────────────────────────────────┤
│  [Download .txt]  [Download .md]    │
├──────────────────┬──────────────────┤
│  Original        │  Optimized       │
│  ─────────────── │  ──────────────  │
│  Your article    │  Revised version │
│  text here...    │  with changes    │
│                  │  highlighted...  │
│                  │                  │
│  (scrolls in     │  (scrolls in     │
│   sync)          │   sync)          │
└──────────────────┴──────────────────┘
```

---

## Prompt Design

### Classify Prompt Structure
```
System: You are an AEO/GEO expert. Your job is two steps:

        STEP 1 — Identify the content type:
        Determine which type best fits this article:
        - blog: educational/informational, no pricing, opinion or analysis
        - product: pricing, features, buy CTA, availability
        - landing: service offering, lead-gen CTA, company/brand focus
        - howto: numbered steps, tools/materials, "how to" in title/headings
        - news: dateline, event-based, named source quotes, published date prominent
        [If user hinted a type, treat it as a strong signal but correct if clearly wrong.]

        STEP 2 — Evaluate against the criteria for that detected type:
        For each criterion return:
        - status: "pass" | "warn" | "fail" | "na"
        - reason: one sentence
        - evidence: 1-3 short direct quotes or line references
        - suggestion: one specific actionable fix (only if warn or fail)

        Return ONLY valid JSON. No commentary.

Criteria:
[list of all criteria with which content types they apply to]

User: [Optional] User believes this is a: [contentTypeHint]

Article:
---
[article text]
---
```

### Improve Prompt Structure
```
System: You are an AEO/GEO content editor. Rewrite the article to fix the issues below.
        Preserve the author's voice, tone, and meaning.
        Output ONLY the revised article. No commentary. No preamble.

User: Issues to fix:
- [criterion title]: [specific suggestion from the report]
- [criterion title]: [specific suggestion from the report]

Original article:
---
[article text]
---
```

Note: The improve prompt only sends the failing/warning criteria suggestions — NOT the full JSON report. This keeps prompts lean.

---

## Component Details

### `ScoreRing.tsx`
SVG circular progress ring. Props: `score` (0–100), `label`, `size`. Color: green ≥75, amber ≥50, red <50. No external library — ~40 lines of SVG math. Matches what the Lovable app already built.

### `ImprovementCard.tsx`
Displays one criterion result. Props: `result: CriterionResult`, `criterion: Criterion`. Shows status icon, impact badge, title, reason, evidence (monospace), and suggestion. Cards sorted: fail → warn → pass.

### `DiffView.tsx`
Two-column layout with synchronized scrolling. Left = original text. Right = optimized text. Simple implementation: `<pre>` blocks in a CSS grid. No diff library in v1 — side-by-side is readable enough. If word-level diff is wanted later, add the `diff` npm package.

### `session.ts`
```ts
// Simple typed sessionStorage helpers — easy for a junior dev to follow
export function saveSession(data: SessionData): void
export function loadSession(): SessionData | null
export function clearSession(): void
```

---

## Environment Variables

```
# web/.env.local
ANTHROPIC_API_KEY=sk-ant-...
# That's it. No Firecrawl key. No OpenAI key.
```

---

## What This Solves From the Improvement Files

| Logged Issue | How This Architecture Addresses It |
|---|---|
| `not_evaluated` counted as 0 | Replaced with `na` status, excluded from average in `score.ts` |
| `fast_page` always unevaluable | Removed from checklist entirely (can't evaluate from text) |
| `accessible` evaluates ARIA (impossible from markdown) | Scoped to markdown-evaluable signals only in `checklists.ts` |
| CLI subprocess + temp files | Eliminated — direct Anthropic SDK calls in API routes |
| Firecrawl dependency + API key | Replaced with Jina AI Reader (free, no key) |
| gpt-4.1-mini quality issues | Replaced with Claude Sonnet 4.6 |
| Improve sends full JSON report twice | Improve prompt only sends failure summaries, not the full JSON |
| Score displayed as 0–3 | Normalized to 0–100 |
| Equal weighting of all criteria | Explicit `weight` field per criterion in checklist |
| No content type awareness | Five content types, auto-detected by Claude in the classify call |
| Manual "Re-classify" step | Auto-redirect to `/optimized` after improve completes |
| No specific fix suggestions | `suggestion` field on every failing criterion from the LLM |

---

## Open Questions Answered

**Q: Is AEO/GEO different for blogs vs product pages?**
Yes, meaningfully:
- Blogs need FAQPage schema, expert attribution, and definition-dense content
- Product pages need Product/Offer/AggregateRating schema, buying guides, and review signals
- Landing pages need Organization/LocalBusiness schema, entity consistency, and conversion-focused FAQs
- How-to guides need HowTo schema, numbered steps as self-contained units, and tool/time callouts

**Q: Do all inputs go on one page?**
Yes — textarea, file upload, and URL entry are three tabs on the same input page. Content type selector sits above them.

**Q: Side-by-side or just optimized?**
Side-by-side with synchronized scrolling on the optimized page.

**Q: What download formats?**
`.txt` and `.md` — same content, different file extension and MIME type. Simple.

---

## What Is NOT In v1

- Auth (no login required)
- Database (sessionStorage only — results lost on refresh)
- Billing / usage limits
- Streaming LLM responses (add later — significant UX improvement for the improve step)
- Word-level inline diff highlighting (add later with `diff` package)
- Batch processing multiple articles
- History of past analyses
