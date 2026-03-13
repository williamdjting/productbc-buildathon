# Architecture Improvement Suggestions

_Identified during codebase review. See also AEO_SCORING_IMPROVEMENTS.md for scoring-specific issues._

## Priority Matrix

| Improvement | Impact | Effort | Do When |
|---|---|---|---|
| Stream LLM responses | High | Low | Now |
| Structured compare UI (remove `/api/compare` route) | Medium | Low | Now |
| Eliminate CLI subprocess bridge | High | Medium | Before production deploy |
| Input validation + rate limiting | Medium | Low | Before public launch |
| Persist sessions (Prisma) | High | Medium | With auth |
| Extensible checklist config | High | Medium | After product-market fit |

---

## 1. Eliminate the CLI subprocess bridge (high impact, medium effort)

Current flow: `Next.js API route → temp file → child_process.spawn → CLI script → stdout → parse`

Problems:
- ~200–500ms overhead per request from spawning a new Node process
- Incompatible with Vercel Edge, Cloudflare Workers, or any serverless platform
- Unnecessary disk I/O via temp files on every request

Fix: Extract prompt logic from `.mjs` scripts into `lib/aeo-engine/` as pure TypeScript functions. CLI scripts become thin wrappers calling the same functions.

```
lib/
  aeo-engine/
    classify.ts     ← pure function: (text: string) => AeoReport
    improve.ts      ← pure function: (report, text) => string
    compare.ts      ← pure function: (old, new) => CompareResult
```

---

## 2. Add streaming responses (high impact, low effort)

All LLM calls are fire-and-forget with a spinner. Improve step on long articles = 15–30s dead air.

Fix: Use OpenAI streaming (`stream: true`) + Next.js `ReadableStream` to stream revised text tokens to the UI in real time.

---

## 3. Persist analysis sessions (medium impact, medium effort)

Prisma stub already exists at `web/src/lib/db/index.ts`. Without persistence:
- Users lose work on refresh
- No history or audit trail
- Can't build billing (can't count uses)

Suggested schema:
```prisma
model Session {
  id            String   @id @default(cuid())
  sourceUrl     String?
  originalText  String
  originalReport Json
  revisedText   String?
  revisedReport Json?
  createdAt     DateTime @default(now())
}
```

Sessions shareable via URL slug without requiring auth (like Notion docs).

---

## 4. Replace plain-text CompareView with structured diff UI (medium impact, low effort)

`CompareView` renders raw text from `compare-aeo.mjs` in a `<pre>` tag — weakest part of the UI.

Fix: Do the comparison client-side (both reports already in React state). Render a color-coded table. Eliminates the `/api/compare` route entirely for the visual use case.

---

## 5. Input validation + rate limiting (low effort, prevents abuse)

No limits on text size or request rate — anyone can burn the OpenAI API key freely.

- Cap input text at ~50,000 chars with a clear error
- IP-based rate limiting via `@upstash/ratelimit` + Redis or in-memory store
- Validate scraped URLs are HTTP/HTTPS (prevent SSRF)

---

## 6. Extensible checklist config (high impact, medium effort)

The 5 AEO criteria are hardcoded in prompt strings. Adding/changing a criterion requires touching the prompt, TypeScript types, and UI separately.

Fix: Define the checklist as a TS config object that drives prompt generation, types, and the UI. Different checklists per content type (blog posts vs. product docs vs. landing pages). Future: user-defined custom criteria.
