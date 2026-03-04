# buildathon-project

AEO (Answer Engine Optimization) toolkit — classify, improve, and compare articles for answer engine discoverability. Available as both a CLI and a web UI.

---

## Web UI (recommended)

### 1. Install dependencies
```bash
cd web
npm install
```

### 2. Set API keys
Edit `web/.env.local`:
```
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...   # only needed for URL scraping
```

### 3. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload a `.txt` or `.md` file (or scrape a URL), then classify → improve → re-classify → compare.

---

## CLI

### Setup
```bash
export OPENAI_API_KEY="your-key-here"
```

### Usage
```bash
# Classify — score an article against the AEO checklist
node classify-aeo.mjs wrodium.txt > wrodium.json

# Improve — rewrite the article to fix failing criteria
node improve-aeo.mjs wrodium.json wrodium.txt -o wrodium-revised.txt

# Reclassify — score the revised article
node classify-aeo.mjs wrodium-revised.txt > wrodium-revised-aeo.json

# Compare — diff the two reports
node compare-aeo.mjs wrodium.json wrodium-revised-aeo.json
```

---

## AEO Checklist Criteria
1. One-paragraph answer near top (40–80 words)
2. Question-style headings (e.g., "What is X?")
3. FAQ or HowTo schema/section
4. Consistent key concept definitions
5. Fast, readable, accessible structure

## Tech Stack
- **CLI** — Node.js ESM (`.mjs`), no external dependencies, native `fetch` and `fs/promises`
- **Web** — Next.js 14 App Router, TypeScript, Tailwind CSS, Firecrawl JS SDK
- **LLM** — OpenAI API (`gpt-4.1-mini`)
