export interface CriterionResult {
  status: "yes" | "no" | "partial" | "not_evaluated";
  reason: string;
  evidence?: string[];
}

export interface PageAccessibility {
  fast_page: CriterionResult;
  readable: CriterionResult;
  accessible: CriterionResult;
}

export interface AeoChecklistEvaluation {
  one_paragraph_answer_near_top: CriterionResult;
  question_style_headings_present: CriterionResult;
  faq_or_howto_schema_present: CriterionResult;
  definitions_consistent: CriterionResult;
  page_fast_readable_accessible: PageAccessibility;
}

export interface ArticleMeta {
  title: string | null;
  date: string | null;
  author: string | null;
  tags: string[] | null;
}

export interface AeoReport {
  schema_version: string;
  article: ArticleMeta;
  aeo_checklist_evaluation: AeoChecklistEvaluation;
}

export interface CompareResult {
  text: string;
}

export interface ClassifyResponse {
  report: AeoReport;
  score: number;
}

export interface ImproveResponse {
  revisedText: string;
}

export interface ScrapeResponse {
  markdown: string;
  url: string;
}
