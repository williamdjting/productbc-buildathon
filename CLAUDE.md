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
- `compare-aeo.mjs` — Compare two AEO JSON reports to see changes

## Usage
```bash
# Set LLM key
export OPENAI_API_KEY="API_KEY"

# Classify — takes wrodium.txt and classifies it into a score
node classify-aeo.mjs wrodium.txt > wrodium.json

# Improve — take the original wrodium.json and improve it
node improve-aeo.mjs wrodium.json wrodium.txt -o wrodium-revised.txt

# Reclassify — classifies the revised article and saves JSON output
node classify-aeo.mjs wrodium-revised.txt > wrodium-revised-aeo.json

# Compare — compare the two JSONs to see the changes
node compare-aeo.mjs wrodium.json wrodium-revised-aeo.json
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
