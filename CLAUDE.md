# buildathon-project

## Project Overview
AEO (Answer Engine Optimization) CLI toolkit. Two Node.js ESM scripts that use OpenAI's API to classify and improve articles for answer engine discoverability.

## Setup
```bash
export OPENAI_API_KEY="your-key-here"
```

## Scripts
- `classify-aeo.mjs` — Score an article against the AEO checklist → JSON report
- `improve-aeo.mjs` — Rewrite an article to address failing AEO criteria

## Usage
```bash
# Classify an article
node classify-aeo.mjs <article.md> > report.json

# Improve based on report
node improve-aeo.mjs <report.json> <article.txt> -o revised.txt

# Re-score the revised article
node classify-aeo.mjs revised.txt > revised-report.json
```

## Tech Stack
- Node.js ESM (`.mjs`), no external dependencies
- Native `fetch` and `fs/promises`
- OpenAI API (`gpt-4.1-mini`)

## AEO Checklist Criteria
1. One-paragraph answer near top (40–80 words)
2. Question-style headings (e.g., "What is X?")
3. FAQ or HowTo schema/section
4. Consistent key concept definitions
5. Fast, readable, accessible structure
