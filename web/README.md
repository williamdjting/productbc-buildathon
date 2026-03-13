# AEO + GEO Toolkit — Web UI

Answer Engine Optimization (AEO) + Generative Engine Optimization (GEO) tool that uses Claude to score and rewrite articles for AI search discoverability.

## Tech Stack

- **Framework** — Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- **LLM** — Anthropic API (`claude-sonnet-4-6`)
- **Scraping** — Jina AI Reader (`https://r.jina.ai/`) — free, no API key required
- **State** — sessionStorage between pages (no database)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the `web/` directory:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> If `npm` is not on your PATH, use the local node environment:
> ```bash
> /path/to/buildathon-project/.node-env/bin/npm run dev
> ```

## User Flow

1. **`/`** — Paste text, upload a `.txt`/`.md` file, or enter a URL to scrape
2. **`/analysis`** — View AEO score, GEO score, overall score, and per-criterion cards with fix suggestions
3. **`/optimized`** — Side-by-side diff of original vs Claude-rewritten article, download as `.txt` or `.md`

## API Routes

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/classify` | POST | `{ text, contentTypeHint? }` | `{ report: AnalysisReport }` |
| `/api/improve` | POST | `{ text, report }` | `{ optimizedText }` |
| `/api/scrape` | POST | `{ url }` | `{ markdown }` |

## Content Types

Auto-detected by Claude, with manual override:

- `blog` — Blog posts, thought leadership, long-form educational
- `product` — Product pages, SaaS feature pages
- `landing` — Marketing pages, lead gen, service pages
- `howto` — Tutorials, step-by-step guides
- `news` — News articles, press releases, editorial

## Scoring

- **AEO score** + **GEO score** each 0–100
- **Overall** = 60% AEO + 40% GEO
- `na` criteria (not applicable to content type) are excluded from the average

## Project Structure

```
src/
  app/
    page.tsx                  — Step 1: Input
    analysis/page.tsx         — Step 2: Scores + improvement cards
    optimized/page.tsx        — Step 3: Diff + download
    api/classify/route.ts     — Classify + score article
    api/improve/route.ts      — Rewrite article with Claude
    api/scrape/route.ts       — Scrape URL via Jina AI Reader
  components/
    StepHeader.tsx            — Sticky step indicator
    ContentTypeSelector.tsx   — Auto-detect + manual override
    ArticleInput.tsx          — Paste / upload / URL tabs
    ScoreRing.tsx             — SVG circular score display
    ImprovementCard.tsx       — Per-criterion result + fix suggestion
    DiffView.tsx              — Side-by-side diff with synced scroll
    ui/                       — shadcn/ui primitives
  lib/
    types.ts                  — TypeScript interfaces
    anthropic.ts              — Anthropic client singleton
    jina.ts                   — Jina AI Reader scraper
    checklists.ts             — AEO/GEO criteria definitions
    prompts.ts                — Prompt builders
    score.ts                  — Scoring logic
    session.ts                — sessionStorage helpers
```
