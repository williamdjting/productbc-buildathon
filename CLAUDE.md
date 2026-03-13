# buildathon-project

## Project Overview
AEO + GEO (Answer Engine / Generative Engine Optimization) toolkit. Node.js ESM CLI scripts + a Next.js web UI that use the Anthropic API (Claude Sonnet 4.6) to classify and improve articles for AI search discoverability.

## Repo Structure
```
buildathon-project/
  classify-aeo.mjs     — CLI: score article → JSON report (OpenAI, standalone)
  improve-aeo.mjs      — CLI: rewrite article to fix failing AEO criteria (OpenAI, standalone)
  compare-aeo.mjs      — CLI: diff two AEO JSON reports (-o flag for file output)
  web/                 — Next.js 16 App Router web UI
    .env.local         — ANTHROPIC_API_KEY (never commit)
    src/
      app/
        page.tsx             — Step 1: Input (paste / upload / URL + content type)
        analysis/page.tsx    — Step 2: AEO + GEO scores, improvement cards
        optimized/page.tsx   — Step 3: Side-by-side diff + download (.txt / .md)
        api/classify/        — POST { text, contentTypeHint? } → { report: AnalysisReport }
        api/improve/         — POST { text, report } → { optimizedText }
        api/scrape/          — POST { url } → { markdown } — uses Jina AI Reader (free)
      components/
        StepHeader.tsx       — sticky step indicator (1→2→3)
        ContentTypeSelector.tsx — auto-detect + 5 manual types
        ArticleInput.tsx     — tabbed: paste / file upload / URL scrape
        ScoreRing.tsx        — SVG circular score (0–100, green/amber/red)
        ImprovementCard.tsx  — single criterion result with Fix suggestion
        DiffView.tsx         — side-by-side original vs optimized, synced scroll
        ui/                  — shadcn/ui primitives (Button, Badge, Card)
      lib/
        types.ts         — all TypeScript interfaces (single source of truth)
        anthropic.ts     — Anthropic client singleton (server-only)
        jina.ts          — Jina AI Reader scraper (server-only)
        checklists.ts    — AEO/GEO criteria for all 5 content types
        prompts.ts       — prompt builders for classify and improve
        score.ts         — scoring: 0–100, na excluded, 60% AEO + 40% GEO
        session.ts       — sessionStorage helpers (client-only)
        auth/index.ts    — placeholder (swap in Clerk/NextAuth)
        db/index.ts      — placeholder (swap in Prisma)
```

## Running the Web UI Locally
```bash
cd web
npm install
# Fill in web/.env.local:
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev   # http://localhost:3000
```

Use `.node-env/bin/npm` if `npm` is not on your PATH:
```bash
export PATH="/path/to/buildathon-project/.node-env/bin:$PATH"
```

## User Flow
1. **/** — Paste text, upload `.txt`/`.md`, or enter a URL to scrape
2. **/analysis** — See AEO score, GEO score, overall score, and per-criterion cards with specific fix suggestions
3. **/optimized** — Side-by-side diff of original vs Claude-rewritten article, download as `.txt` or `.md`

## Tech Stack
- **Web** — Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- **LLM** — Anthropic API (`claude-sonnet-4-6`) — 200K context, structured JSON output
- **Scraping** — Jina AI Reader (`https://r.jina.ai/`) — free, no API key required
- **State** — sessionStorage between pages (no database for v1)
- **CLI** — Node.js ESM, uses OpenAI API independently (separate from the web UI)

## Content Types Supported
Auto-detected by Claude in the classify call. User can override.
- `blog` — Blog posts, thought leadership, long-form educational
- `product` — Product pages, SaaS feature pages
- `landing` — Marketing pages, lead gen, service pages
- `howto` — Tutorials, step-by-step guides
- `news` — News articles, press releases, editorial

## Scoring
- AEO score + GEO score each 0–100, weighted by criterion impact
- Overall = 60% AEO + 40% GEO
- `na` criteria (not applicable to the detected content type) are excluded from the average
- All defined in `lib/score.ts` and `lib/checklists.ts`

## API Routes
| Route | Method | Input | Output |
|---|---|---|---|
| `/api/classify` | POST | `{ text, contentTypeHint? }` | `{ report: AnalysisReport }` |
| `/api/improve` | POST | `{ text, report }` | `{ optimizedText }` |
| `/api/scrape` | POST | `{ url }` | `{ markdown }` |

## CLI Usage (standalone, uses OpenAI)
```bash
export OPENAI_API_KEY="sk-..."

node classify-aeo.mjs wrodium.txt > wrodium.json
node improve-aeo.mjs wrodium.json wrodium.txt -o wrodium-revised.txt
node classify-aeo.mjs wrodium-revised.txt > wrodium-revised-aeo.json
node compare-aeo.mjs wrodium.json wrodium-revised-aeo.json
```

## Adding Auth (additive, no rewrites)
```bash
npm install @clerk/nextjs
# Wrap web/src/app/layout.tsx with <ClerkProvider>
# Add web/src/middleware.ts with clerkMiddleware
# Replace web/src/lib/auth/index.ts stub
```

## Adding a Database (additive, no rewrites)
```bash
npm install prisma @prisma/client
# Replace web/src/lib/db/index.ts stub with PrismaClient
# Schema: AnalysisSession { id, userId, originalText, report, optimizedText, createdAt }
```

## Adding Stripe Payments (additive, no rewrites)
```bash
npm install stripe @stripe/stripe-js
```

Add to `web/.env.local`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Integration points (all additive):
- `web/src/lib/stripe.ts` — server-only Stripe singleton
- `web/src/app/api/stripe/checkout/route.ts` — creates Checkout Session
- `web/src/app/api/stripe/webhook/route.ts` — handles `checkout.session.completed`
- `web/src/middleware.ts` — gates `/api/classify` and `/api/improve` behind active subscription
