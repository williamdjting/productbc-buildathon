# LLM & Scraping Improvements

_Decisions made during codebase review. Implement alongside ARCHITECTURE_IMPROVEMENTS.md and AEO_SCORING_IMPROVEMENTS.md._

---

## 1. Switch LLM: gpt-4.1-mini → claude-sonnet-4-6

### Why gpt-4.1-mini is wrong for this workload

| Requirement | Why it matters |
|---|---|
| Long context (100K+) | Improve step sends full article + full JSON report + prompt — large articles hit 20K+ tokens |
| Reliable structured JSON | Classify must return exact schema every time — a bad output breaks the pipeline |
| Nuanced judgment | yes/partial/no distinctions require real content understanding |
| Writing quality | Improve step must rewrite while preserving author voice and tone |
| Instruction following | Classify prompt has complex forbidden behaviors and multi-field schema |

### Why claude-sonnet-4-6

- 200K token context window — no article will ever be too long
- Best-in-class instruction following — respects complex constraints ("do NOT summarize", "output ONLY") more reliably
- Superior writing quality for the improve step (preserves authorial voice)
- Consistent structured output — fewer hallucinated fields, fewer schema violations
- Native JSON/tool use as a first-class feature
- Directly fixes scoring bugs 3 & 4 (accessible/fast_page criterion confusion) when combined with prompt fixes

### Optional split (cost optimisation, do later)
- classify step → claude-haiku-4-5 (pure JSON classification, cheaper)
- improve step → claude-sonnet-4-6 (writing quality matters here)

### Files to change
- `classify-aeo.mjs` — swap OpenAI fetch for Anthropic SDK call, update model string
- `improve-aeo.mjs` — same
- Eventually: move both to `web/src/lib/aeo-engine/` as native TS functions (see ARCHITECTURE_IMPROVEMENTS.md #1)

---

## 2. Replace Firecrawl → Jina AI Reader

### Why drop Firecrawl
- Paid service requiring `FIRECRAWL_API_KEY`
- `@mendable/firecrawl-js` requires Node >=22 (caused EBADENGINE warning on install)
- Only used for one thing: URL → markdown conversion
- Overkill for public blog posts and standard article HTML

### Replacement: Jina AI Reader
- Free tier, no API key required
- Returns clean markdown from any URL
- Handles JS-rendered pages server-side
- Zero npm dependencies

```ts
// web/src/app/api/scrape/route.ts — new implementation
const response = await fetch(`https://r.jina.ai/${url}`, {
  headers: { Accept: "text/markdown" }
});
const markdown = await response.text();
```

Replaces the entire `web/src/lib/firecrawl.ts` singleton. Delete that file and remove `FIRECRAWL_API_KEY` from `.env.local`.

### Fallback option (fully offline, no external service)
`@mozilla/readability` — the algorithm Firefox uses to extract article content.
Works on any fetched HTML, self-hosted, no rate limits.

### Files to change
- `web/src/app/api/scrape/route.ts` — replace firecrawl client with Jina fetch
- `web/src/lib/firecrawl.ts` — delete
- `web/package.json` — remove `@mendable/firecrawl-js`
- `web/.env.local` — remove `FIRECRAWL_API_KEY`
- `CLAUDE.md` / `README.md` — remove Firecrawl setup instructions

---

## How these connect to other improvement files

| Other issue | How LLM/scraping switch helps |
|---|---|
| AEO scoring bug 3/4 (accessible, fast_page) | Stronger model follows scoped prompt constraints more reliably |
| AEO issue 5 (full JSON sent twice) | 200K context makes it less painful, but still fix it |
| Architecture #1 (eliminate subprocess) | Once LLM calls are native TS + scraping is plain fetch, stack is fully serverless-deployable |
| Architecture #2 (streaming) | Anthropic SDK has first-class streaming support |
