# Final Implementation Plan
_Consolidated from: AEO_SCORING_IMPROVEMENTS, ARCHITECTURE_IMPROVEMENTS, LLM_AND_SCRAPING_IMPROVEMENTS, IDEAL_ARCHITECTURE_PLAN, IMPLEMENTATION_PLAN_
_Each step is tested before the next one starts._

---

## Current State Snapshot

```
web/src/
├── app/
│   ├── api/classify/route.ts   ← spawns classify-aeo.mjs via child_process
│   ├── api/compare/route.ts    ← spawns compare-aeo.mjs
│   ├── api/improve/route.ts    ← spawns improve-aeo.mjs via child_process
│   ├── api/scrape/route.ts     ← uses Firecrawl
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                ← single page, 5-step React state machine
├── components/
│   ├── AeoReport.tsx
│   ├── CompareView.tsx
│   ├── FileUploader.tsx
│   ├── RevisedArticle.tsx
│   ├── ScoreGauge.tsx
│   └── UrlScraper.tsx
└── lib/
    ├── auth/index.ts
    ├── db/index.ts
    ├── firecrawl.ts
    ├── spawn-script.ts
    ├── temp-files.ts
    └── types.ts
```

**Known problems being fixed:**
- LLM: `gpt-4.1-mini` via OpenAI → `claude-sonnet-4-6` via Anthropic SDK
- Scoring: `not_evaluated` counted as 0 (should be excluded) → `na` status excluded from average
- Scoring: `fast_page` always unevaluable from text → removed from checklist
- Scoring: `accessible` marks markdown for missing ARIA → scoped to markdown-only signals
- Scoring: 0–3 scale displayed to user → normalized to 0–100
- Scoring: all criteria weighted equally → explicit weighted scoring per criterion
- Scraping: Firecrawl (paid, Node >=22 required) → Jina AI Reader (free, plain fetch)
- Architecture: subprocess spawn + temp files → direct Anthropic SDK in API routes
- Architecture: single page 5-step state machine → 3 real pages with sessionStorage
- Architecture: one universal checklist → 5 content types, auto-detected by Claude
- Architecture: no specific fix suggestions → `suggestion` field per failing criterion
- Architecture: improve prompt sends full JSON report → only sends failure summaries
- UX: no content type awareness → auto-detect + user override
- UX: no side-by-side diff → DiffView with synchronized scrolling
- UX: download not available → .txt and .md download buttons

---

## Rules for Implementation

1. **One step at a time.** Do not start Step N+1 until Step N passes its test.
2. **Test criteria are mandatory.** Each step has a "Done when" section — hit all of them.
3. **Keep old files until their replacement is tested.** Only delete after the new version works.
4. **No new features beyond what is listed.** Keep it simple.

---

## Step 1 — Dependencies & Environment

**What:** Install Anthropic SDK, uninstall Firecrawl, install shadcn/ui primitives, update env vars.

### Actions

```bash
cd web

# 1a. Install Anthropic SDK
npm install @anthropic-ai/sdk

# 1b. Remove Firecrawl
npm uninstall @mendable/firecrawl-js

# 1c. Init shadcn/ui (Tailwind v4 compatible)
npx shadcn@latest init
# Prompts: Style = Default, Base color = Slate, CSS variables = Yes

# 1d. Add the three primitives we need
npx shadcn@latest add button badge card
```

Update `web/.env.local`:
```
# Remove:
OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...

# Add:
ANTHROPIC_API_KEY=sk-ant-...
```

### Done when
- [ ] `npm run dev` starts with no errors in terminal
- [ ] No TypeScript or import errors on startup
- [ ] `@anthropic-ai/sdk` appears in `package.json` dependencies
- [ ] `@mendable/firecrawl-js` is gone from `package.json`
- [ ] shadcn/ui Button, Badge, Card can be imported without errors

---

## Step 2 — Shared Lib Layer

**What:** Create all `lib/` files. These are pure functions with no UI dependencies. They are the foundation everything else builds on.

### Files to create / replace

| File | Action | What it does |
|---|---|---|
| `lib/types.ts` | Replace entirely | All TypeScript interfaces — single source of truth |
| `lib/anthropic.ts` | New | Anthropic client singleton (server-only) |
| `lib/jina.ts` | New | Jina URL scraper (replaces firecrawl.ts) |
| `lib/checklists.ts` | New | All AEO/GEO criteria for all 5 content types |
| `lib/prompts.ts` | New | Prompt builder functions for classify and improve |
| `lib/score.ts` | New | Score calculation — 0–100, na excluded, weighted |
| `lib/session.ts` | New | sessionStorage helpers (client-only) |

### Key design decisions in this step

**`lib/types.ts`** — replaces old types entirely:
```ts
export type ContentType = "blog" | "product" | "landing" | "howto" | "news";
export type ContentTypeOrAuto = ContentType | "auto";

export interface Criterion {
  id: string;
  category: "aeo" | "geo";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  weight: number;           // 0–1 per category; weights within category sum to 1
  contentTypes: ContentType[];
}

export interface CriterionResult {
  id: string;
  status: "pass" | "warn" | "fail" | "na";  // na = excluded from scoring
  reason: string;
  evidence: string[];
  suggestion: string;       // empty if pass/na
}

export interface AnalysisReport {
  detectedContentType: ContentType;
  contentTypeConfidence: "high" | "low";
  aeoScore: number;         // 0–100
  geoScore: number;         // 0–100
  overallScore: number;     // 0–100 = 60% AEO + 40% GEO
  results: CriterionResult[];
}

export interface SessionData {
  originalText: string;
  contentTypeHint: ContentTypeOrAuto;
  report: AnalysisReport;
  optimizedText?: string;
}

// API shapes
export interface ClassifyRequest { text: string; contentTypeHint?: ContentTypeOrAuto; }
export interface ClassifyResponse { report: AnalysisReport; }
export interface ImproveRequest { text: string; report: AnalysisReport; }
export interface ImproveResponse { optimizedText: string; }
export interface ScrapeRequest { url: string; }
export interface ScrapeResponse { markdown: string; }
```

**`lib/score.ts`** — fixes all scoring bugs:
- `na` → excluded (not counted as 0)
- `pass` = full weight, `warn` = half weight, `fail` = 0
- AEO and GEO scored separately then combined 60/40
- All results 0–100

**`lib/checklists.ts`** — shared criteria + 5 type-specific sets:
- Shared: `direct_answer_near_top`, `question_style_headings`, `short_paragraphs_and_lists`, `named_sources_citations`, `author_and_date`
- Blog: `faq_section`, `concept_definitions`, `topical_depth`, `expert_attribution`
- Product: `product_schema_signals`, `product_faq`, `review_signals`
- Landing: `value_proposition_clear`, `conversion_faq`, `entity_consistency`
- How-to: `numbered_steps`, `tools_time_callout`, `howto_faq`
- News: `news_freshness`, `named_sources_quotes`, `news_article_schema_signals`
- NOT included: `fast_page` (can't evaluate from text), `accessible` ARIA signals (can't evaluate from markdown)

**`lib/prompts.ts`** — two functions:
- `buildClassifyPrompt(hint?)` → system + user builder: Step 1 detect type, Step 2 evaluate
- `buildImprovePrompt(report)` → system + user builder: only sends failing criterion suggestions, NOT the full JSON report

### Done when
- [ ] `npx tsc --noEmit` (from web/) shows zero type errors
- [ ] All 7 lib files exist and import each other cleanly
- [ ] `getCriteria("blog")` returns shared + blog criteria (verify by logging in a test file)
- [ ] `calcScores()` with all-`na` results returns `{ aeoScore: 0, geoScore: 0, overallScore: 0 }` — not NaN
- [ ] `calcScores()` with one `pass` and one `na` correctly excludes the `na` from the average

---

## Step 3 — API Routes

**What:** Rewrite all three API routes to use the new lib layer directly. No subprocess, no temp files.

### 3a. Rewrite `api/classify/route.ts`

```
POST /api/classify
Body: { text: string, contentTypeHint?: ContentTypeOrAuto }
Response: { report: AnalysisReport }
```

Flow:
1. Validate `text` is present
2. `buildClassifyPrompt(contentTypeHint)` → system + user strings
3. Call `claude-sonnet-4-6` via Anthropic SDK, max_tokens: 4096
4. `JSON.parse()` the response text
5. `calcScores(parsed.results, getAllCriteria())` → scores
6. Assemble and return `AnalysisReport`
7. Wrap everything in try/catch → return `{ error }` with status 500

### 3b. Rewrite `api/improve/route.ts`

```
POST /api/improve
Body: { text: string, report: AnalysisReport }
Response: { optimizedText: string }
```

Flow:
1. Validate `text` and `report` are present
2. `buildImprovePrompt(report)` → system + user strings (only failing/warn items, NOT full JSON)
3. Call `claude-sonnet-4-6`, max_tokens: 8192
4. Return `optimizedText` as the raw response text (no JSON parsing)

### 3c. Rewrite `api/scrape/route.ts`

```
POST /api/scrape
Body: { url: string }
Response: { markdown: string }
```

Flow:
1. Validate `url`
2. `scrapeUrl(url)` from `lib/jina.ts` → Jina fetch
3. Return `{ markdown }`

### 3d. Delete `api/compare/route.ts`

No longer needed. Comparison happens client-side on the optimized page.

### Done when
- [ ] `POST /api/scrape { "url": "https://example.com" }` returns `{ markdown: "..." }` with real content
- [ ] `POST /api/classify { "text": "..." }` returns `{ report: { detectedContentType, aeoScore, geoScore, overallScore, results[] } }` with real scores
- [ ] `detectedContentType` is one of the 5 valid types (not undefined)
- [ ] `aeoScore`, `geoScore`, `overallScore` are numbers between 0 and 100
- [ ] `results` array contains entries with `status`, `reason`, `evidence`, `suggestion`
- [ ] No `na` result has a non-empty `suggestion`
- [ ] `POST /api/improve { "text": "...", "report": {...} }` returns `{ optimizedText: "..." }` with a full rewritten article
- [ ] Old `lib/spawn-script.ts` and `lib/temp-files.ts` are no longer imported anywhere (but not deleted yet)
- [ ] Old `lib/firecrawl.ts` is no longer imported anywhere (but not deleted yet)

---

## Step 4 — New Components

**What:** Build the 6 new UI components. Write each independently. They should work without the new pages being done.

### Components to build

| Component | Replaces | Key props |
|---|---|---|
| `StepHeader.tsx` | nothing | `step: 1\|2\|3`, `onBack?` |
| `ContentTypeSelector.tsx` | nothing | `value: ContentTypeOrAuto`, `onChange` |
| `ArticleInput.tsx` | `FileUploader.tsx` + `UrlScraper.tsx` | `onContent: (text) => void` |
| `ScoreRing.tsx` | `ScoreGauge.tsx` | `score: number`, `label: string` |
| `ImprovementCard.tsx` | `AeoReport.tsx` | `result: CriterionResult`, `criterion: Criterion` |
| `DiffView.tsx` | `CompareView.tsx` | `original: string`, `optimized: string` |

### Key implementation notes

**`ArticleInput.tsx`** — three tabs on one component:
- Tab 1 "Paste text": large `<textarea>`
- Tab 2 "Upload file": drag-drop zone, accepts `.txt` and `.md`, reads via `file.text()`
- Tab 3 "Scrape URL": input + Fetch button → calls `/api/scrape` → puts result in shared text state
- Word count shown below whichever tab is active
- Single `onContent` callback fires whenever text changes from any tab

**`ScoreRing.tsx`** — pure SVG, no library:
- Circular ring, score 0–100 in the center
- Green ≥75, amber ≥50, red <50
- Smooth CSS transition on the dashoffset

**`ImprovementCard.tsx`** — sorted fail → warn → pass → na:
- Status icon (✗ / ⚠ / ✓ / –)
- Impact badge (high/medium/low)
- Category badge (AEO/GEO)
- Reason text
- Evidence quotes in monospace
- Suggestion box (only shown when non-empty)

**`DiffView.tsx`** — side-by-side with synchronized scroll:
- Two `<pre>` blocks in a CSS grid
- `onScroll` on each syncs the other's `scrollTop`
- Original on left (neutral background), optimized on right (green tint)

### Done when
- [ ] Import each component into a temporary test area in `page.tsx` and visually confirm it renders
- [ ] `ScoreRing` renders correct color at 30 (red), 60 (amber), 80 (green)
- [ ] `ArticleInput` — paste tab works, file upload tab loads a .txt file, URL tab calls `/api/scrape` and populates text
- [ ] `ImprovementCard` renders all four status states correctly
- [ ] `DiffView` — both panels scroll together
- [ ] `ContentTypeSelector` — "Auto-detect" selected by default, clicking another option selects it

---

## Step 5 — New Pages (Routing)

**What:** Rewrite `page.tsx` as the input page. Create two new route directories with their page files.

### 5a. Rewrite `app/page.tsx` — Input page (Step 1)

State:
```ts
const [contentTypeHint, setContentTypeHint] = useState<ContentTypeOrAuto>("auto");
const [text, setText] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

On "Analyze →" click:
1. `POST /api/classify { text, contentTypeHint }`
2. `saveSession({ originalText: text, contentTypeHint, report: data.report })`
3. `router.push("/analysis")`

Layout:
- `<StepHeader step={1} />`
- `<ContentTypeSelector />` above the input
- `<ArticleInput onContent={setText} />`
- Word count + error display
- "Analyze →" button (disabled if no text or loading)

### 5b. Create `app/analysis/page.tsx` — Analysis page (Step 2)

On mount:
- `loadSession()` — if null → `router.replace("/")`

State read from session:
- `report.overallScore`, `report.aeoScore`, `report.geoScore` → three `<ScoreRing>`
- `report.detectedContentType` → show "Detected as: Blog Post"
- `report.contentTypeConfidence === "low"` → show warning badge
- `report.results` sorted fail → warn → pass → na → `<ImprovementCard>` per result

On "Optimize Article →" click:
1. `POST /api/improve { text: session.originalText, report }`
2. `updateSession({ optimizedText: data.optimizedText })`
3. `router.push("/optimized")`

### 5c. Create `app/optimized/page.tsx` — Optimized page (Step 3)

On mount:
- `loadSession()` — if null or no `optimizedText` → `router.replace("/")`

Layout:
- `<StepHeader step={3} />`
- Download buttons (`.txt` and `.md`) — use `Blob` + `URL.createObjectURL`
- `<DiffView original={session.originalText} optimized={session.optimizedText} />`
- "Start over" link → `clearSession()` + `router.push("/")`

### Create route directories

```bash
mkdir -p web/src/app/analysis web/src/app/optimized
```

### Done when
- [ ] Navigating to `/` shows the input page with content type selector and article input
- [ ] Pasting text and clicking Analyze shows loading state, then navigates to `/analysis`
- [ ] `/analysis` shows three score rings with correct values
- [ ] `/analysis` shows "Detected as: [Type]" badge
- [ ] Low-confidence detection shows the yellow warning
- [ ] ImprovementCards are sorted fail → warn → pass
- [ ] Each failing card shows a non-empty suggestion
- [ ] Clicking "Optimize Article →" shows loading state, then navigates to `/optimized`
- [ ] `/optimized` shows side-by-side diff
- [ ] Download .txt downloads a file named `optimized-article.txt`
- [ ] Download .md downloads a file named `optimized-article.md`
- [ ] "Start over" clears session and returns to `/`
- [ ] Navigating directly to `/analysis` with no sessionStorage redirects to `/`
- [ ] Navigating directly to `/optimized` with no sessionStorage redirects to `/`
- [ ] Browser back button from `/analysis` → `/` works correctly

---

## Step 6 — Cleanup

**What:** Delete all old files that are fully replaced. Update docs.

### Files to delete

```bash
# Old lib files (replaced in Step 2)
rm web/src/lib/firecrawl.ts
rm web/src/lib/spawn-script.ts
rm web/src/lib/temp-files.ts

# Old components (replaced in Step 4)
rm web/src/components/AeoReport.tsx
rm web/src/components/ScoreGauge.tsx
rm web/src/components/RevisedArticle.tsx
rm web/src/components/CompareView.tsx
rm web/src/components/FileUploader.tsx
rm web/src/components/UrlScraper.tsx

# Old API route (replaced with client-side comparison)
rm web/src/app/api/compare/route.ts
```

### CLAUDE.md updates
- Remove Firecrawl setup instructions
- Replace `OPENAI_API_KEY` + `FIRECRAWL_API_KEY` with `ANTHROPIC_API_KEY`
- Update web UI section to describe the 3-page flow

### Done when
- [ ] `npm run build` completes with zero errors
- [ ] No remaining imports of deleted files anywhere in the codebase
- [ ] `grep -r "firecrawl" web/src` returns no results
- [ ] `grep -r "spawn-script" web/src` returns no results
- [ ] `grep -r "openai" web/src` returns no results
- [ ] Full end-to-end test passes (Step 5 test list)

---

## Complete Change Table

| File | Action | Step |
|---|---|---|
| `web/src/lib/types.ts` | Replace | 2 |
| `web/src/lib/anthropic.ts` | New | 2 |
| `web/src/lib/jina.ts` | New | 2 |
| `web/src/lib/checklists.ts` | New | 2 |
| `web/src/lib/prompts.ts` | New | 2 |
| `web/src/lib/score.ts` | New | 2 |
| `web/src/lib/session.ts` | New | 2 |
| `web/src/lib/firecrawl.ts` | Delete | 6 |
| `web/src/lib/spawn-script.ts` | Delete | 6 |
| `web/src/lib/temp-files.ts` | Delete | 6 |
| `web/src/app/api/classify/route.ts` | Rewrite | 3 |
| `web/src/app/api/improve/route.ts` | Rewrite | 3 |
| `web/src/app/api/scrape/route.ts` | Rewrite | 3 |
| `web/src/app/api/compare/route.ts` | Delete | 6 |
| `web/src/components/StepHeader.tsx` | New | 4 |
| `web/src/components/ContentTypeSelector.tsx` | New | 4 |
| `web/src/components/ArticleInput.tsx` | New | 4 |
| `web/src/components/ScoreRing.tsx` | New | 4 |
| `web/src/components/ImprovementCard.tsx` | New | 4 |
| `web/src/components/DiffView.tsx` | New | 4 |
| `web/src/components/AeoReport.tsx` | Delete | 6 |
| `web/src/components/ScoreGauge.tsx` | Delete | 6 |
| `web/src/components/RevisedArticle.tsx` | Delete | 6 |
| `web/src/components/CompareView.tsx` | Delete | 6 |
| `web/src/components/FileUploader.tsx` | Delete | 6 |
| `web/src/components/UrlScraper.tsx` | Delete | 6 |
| `web/src/app/page.tsx` | Rewrite | 5 |
| `web/src/app/analysis/page.tsx` | New | 5 |
| `web/src/app/optimized/page.tsx` | New | 5 |
| `web/.env.local` | Update keys | 1 |
| `web/package.json` | Update deps | 1 |
| `CLAUDE.md` | Update docs | 6 |

**Total: 14 new files, 10 rewrites/replaces, 9 deletes**

---

## What Is Intentionally Left Out of v1

These are documented in the improvement files but are **not in scope** for this implementation:

| Feature | Why deferred |
|---|---|
| Streaming LLM responses | Requires server-sent events plumbing — add after core flow works |
| Word-level inline diff | Add `diff` npm package later — side-by-side is good enough for v1 |
| Prisma / database | No auth yet — sessionStorage is sufficient |
| Auth (Clerk/NextAuth) | Not needed for MVP |
| Rate limiting | Add before public launch |
| Re-classify after improve | Add after v1 is stable — auto-reclassify and show score delta |
| Model split (Haiku for classify, Sonnet for improve) | Cost optimisation — do after validating quality |
