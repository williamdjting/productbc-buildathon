# buildathon-project

## Project Overview
AEO (Answer Engine Optimization) toolkit. Node.js ESM CLI scripts + a Next.js web UI that use OpenAI's API to classify and improve articles for answer engine discoverability.

## Repo Structure
```
buildathon-project/
  classify-aeo.mjs     — CLI: score article → JSON report
  improve-aeo.mjs      — CLI: rewrite article to fix failing AEO criteria
  compare-aeo.mjs      — CLI: diff two AEO JSON reports (-o flag for file output)
  web/                 — Next.js 14 App Router web UI
    .env.local         — OPENAI_API_KEY, FIRECRAWL_API_KEY (never commit)
    src/
      app/
        page.tsx       — main UI (classify → improve → reclassify → compare)
        api/classify/  — POST: runs classify-aeo.mjs, returns { report, score }
        api/improve/   — POST: runs improve-aeo.mjs, returns { revisedText }
        api/compare/   — POST: runs compare-aeo.mjs -o, reads file, returns { text }
        api/scrape/    — POST: Firecrawl scrape URL → markdown
      components/      — FileUploader, UrlScraper, AeoReport, ScoreGauge, RevisedArticle, CompareView
      lib/
        spawn-script.ts  — child_process.spawn wrapper → Promise<string>
        temp-files.ts    — mkdtemp + cleanup
        firecrawl.ts     — server-only Firecrawl singleton
        types.ts         — AeoReport TypeScript interfaces
        auth/index.ts    — placeholder (swap in Clerk/NextAuth)
        db/index.ts      — placeholder (swap in Prisma)
```

## Running the Web UI Locally
```bash
cd web
npm install
# Fill in web/.env.local:
#   OPENAI_API_KEY=sk-...
#   FIRECRAWL_API_KEY=fc-...
npm run dev   # http://localhost:3000
```

## CLI Usage
```bash
export OPENAI_API_KEY="API_KEY"

node classify-aeo.mjs wrodium.txt > wrodium.json
node improve-aeo.mjs wrodium.json wrodium.txt -o wrodium-revised.txt
node classify-aeo.mjs wrodium-revised.txt > wrodium-revised-aeo.json
node compare-aeo.mjs wrodium.json wrodium-revised-aeo.json
```

## Tech Stack
- **CLI** — Node.js ESM, no external dependencies, native `fetch` and `fs/promises`
- **Web** — Next.js 14 App Router, TypeScript, Tailwind CSS, `@mendable/firecrawl-js`
- **LLM** — OpenAI API (`gpt-4.1-mini`)

## AEO Checklist Criteria
1. One-paragraph answer near top (40–80 words)
2. Question-style headings (e.g., "What is X?")
3. FAQ or HowTo schema/section
4. Consistent key concept definitions
5. Fast, readable, accessible structure

## Script Integration (web → CLI)
API routes write uploaded content to `mkdtemp` temp files, spawn the `.mjs` script with those paths, capture stdout (or read `-o` output file for compare), clean up, and return JSON. Zero changes required to the CLI scripts when modifying the web UI.

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
# Schema: AnalysisSession { id, userId, originalText, aeoReport, revisedText }
```

## Adding Stripe Payments (additive, no rewrites)
Next.js App Router is fully supported by Stripe's official SDK and webhook pattern.

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
- `web/src/lib/stripe.ts` — server-only Stripe singleton (`new Stripe(process.env.STRIPE_SECRET_KEY)`)
- `web/src/app/api/stripe/checkout/route.ts` — creates a Checkout Session, redirects user to Stripe-hosted page
- `web/src/app/api/stripe/webhook/route.ts` — receives `checkout.session.completed` events, updates user subscription status in DB
- `web/src/middleware.ts` — gate `/api/classify`, `/api/improve`, `/api/compare` behind an active subscription check (one middleware file, no route changes)

Recommended flow: free tier allows N classifies/day → Stripe Checkout for a subscription → webhook flips `user.isPro` in DB → middleware unlocks full access.
