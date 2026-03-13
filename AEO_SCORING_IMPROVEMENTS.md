# AEO Scoring & Optimization — Issues & Fix Plan

_Deep-dive on the scoring and LLM optimization logic. See ARCHITECTURE_IMPROVEMENTS.md for infrastructure issues._

---

## Bugs

### Bug 1 (Critical): `not_evaluated` counted as 0 in average

File: `web/src/app/api/classify/route.ts` lines 6-33, and `compare-aeo.mjs` line 7

`not_evaluated` is mapped to 0 and included in both numerator and denominator of the average.
It should be excluded entirely — it is not a failure, it means "cannot assess from this input."

Real-world impact (wrodium sample):
- Before optimization: 2.29 / 3 (current) → 2.67 / 3 (fixed)
- After optimization:  2.43 / 3 (current) → 2.83 / 3 (fixed)

Fix: filter out `not_evaluated` before computing the average.

```ts
// classify/route.ts calcScore fix
function calcScore(report: AeoReport): number {
  const statuses = flattenStatuses(report.aeo_checklist_evaluation)
    .filter((v) => v !== STATUS_SCORE.not_evaluated);  // exclude unevaluable
  if (statuses.length === 0) return 0;
  const sum = statuses.reduce((a, b) => a + b, 0);
  return parseFloat(((sum / statuses.length / 3) * 100).toFixed(1)); // normalized to 0-100
}
```

---

### Bug 2 (Critical): `fast_page` is structurally always `not_evaluated`

`fast_page` within `page_fast_readable_accessible` will never be anything but `not_evaluated`
when analyzing markdown. The LLM cannot infer page load speed from text content.

This permanently drags down every article's score with no actionable path to fix it.

Options:
- A) Remove `fast_page` from the schema and scoring entirely
- B) Replace with a markdown-evaluable criterion (e.g., "no excessive embedded media", "reasonable article length")

---

### Bug 3 (Design): Equal weighting across unequal-impact criteria

All 7 status fields averaged equally. AEO impact is not equal:

| Criterion | AEO Impact | Issue |
|---|---|---|
| One-paragraph answer | Very High | Should weight 2x |
| Question-style headings | High | Fine |
| FAQ/HowTo schema | High | Fine |
| Consistent definitions | Medium | Fine |
| Readable | Medium | Fine |
| Accessible | Low | Markdown can't evaluate ARIA/alt text |
| Fast page | Zero | Never evaluated, should be removed |

---

### Bug 4 (Design): `accessible` evaluates things markdown cannot have

The model reliably marks `accessible` as `partial` citing missing ARIA tags or alt text.
Markdown files cannot contain ARIA attributes. This generates a permanent score drag with
no actionable fix for the user.

Fix: Scope the accessible criterion in the classify prompt to markdown-evaluable signals:
- Heading hierarchy (h1 → h2 → h3, no skipped levels)
- Alt text in `![alt](url)` image syntax
- Descriptive link text (not "click here")
- Table headers present when tables are used

---

## Inefficiencies

### Issue 5: Improve prompt sends full JSON report twice

File: `improve-aeo.mjs` lines 83-96

`reportSummary` already digests the failing criteria. Sending `JSON.stringify(reportJson, null, 2)`
on top is redundant and adds 1,000–2,000 tokens per request on large articles.

Fix: Remove the `Full AEO report (for reference)` section from the user prompt. The summary is sufficient.

---

### Issue 6: No verification that improvement actually improved

The pipeline trusts the LLM rewrite worked. The user must manually trigger "Re-classify & Compare"
to find out. Sometimes rewrites break previously passing criteria (regressions).

Fix: Auto-reclassify immediately after improve completes. Surface pass/fail inline.
Bonus: if a criterion that was passing is now failing, warn the user before showing the revised text.

---

### Issue 7: Score displayed as 0–3, not 0–100

`ScoreGauge` converts to % internally but shows `2.43 / 3` to the user.
Nobody thinks in thirds. Normalize to 0–100 for legibility.

---

## Fix Priority Order

1. Fix `not_evaluated` exclusion from average → one-line change, high accuracy impact
2. Remove `fast_page` from schema/scoring or replace with markdown-evaluable criterion
3. Scope `accessible` criterion to markdown-evaluable signals in classify prompt
4. Auto-reclassify after improve (eliminate manual step)
5. Remove full JSON from improve prompt (token cost reduction)
6. Normalize score display to 0–100
7. Weighted scoring (nice-to-have after above are done)
