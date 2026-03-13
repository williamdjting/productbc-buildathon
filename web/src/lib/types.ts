// ─── Content types ────────────────────────────────────────────────────────────

export type ContentType = "blog" | "product" | "landing" | "howto" | "news";

// "auto" means the user left it on auto-detect — Claude will determine the type
export type ContentTypeOrAuto = ContentType | "auto";

// ─── Checklist ────────────────────────────────────────────────────────────────

// A single evaluation criterion defined in checklists.ts
export interface Criterion {
  id: string;
  category: "aeo" | "geo";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  // Scoring weight within its category (0–1). Weights per category sum to 1.
  weight: number;
  // Which content types this criterion applies to
  contentTypes: ContentType[];
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

// Claude's verdict on one criterion
export interface CriterionResult {
  id: string;
  // "na" = not applicable to this content type — excluded from scoring entirely
  status: "pass" | "warn" | "fail" | "na";
  reason: string;       // one sentence explaining the verdict
  evidence: string[];   // 1–3 short direct quotes or line references from the article
  suggestion: string;   // specific actionable fix — empty string if status is pass or na
}

// The full report returned by /api/classify
export interface AnalysisReport {
  detectedContentType: ContentType;
  contentTypeConfidence: "high" | "low"; // "low" triggers a warning badge in the UI
  aeoScore: number;     // 0–100
  geoScore: number;     // 0–100
  overallScore: number; // 0–100, calculated as 60% AEO + 40% GEO
  results: CriterionResult[];
}

// ─── Session ──────────────────────────────────────────────────────────────────

// Everything stored in sessionStorage between the three pages
export interface SessionData {
  originalText: string;
  contentTypeHint: ContentTypeOrAuto; // what the user selected on the input page
  report: AnalysisReport;
  optimizedText?: string; // set after /api/improve completes
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface ClassifyRequest {
  text: string;
  contentTypeHint?: ContentTypeOrAuto;
}

export interface ClassifyResponse {
  report: AnalysisReport;
}

export interface ImproveRequest {
  text: string;
  report: AnalysisReport;
}

export interface ImproveResponse {
  optimizedText: string;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  markdown: string;
}
