import type { Criterion, ContentType } from "./types";

// ─── Shared criteria (apply to ALL content types) ─────────────────────────────
// AEO weights sum to 1.0 across shared + type-specific AEO criteria.
// GEO weights sum to 1.0 across shared + type-specific GEO criteria.

const SHARED: Criterion[] = [
  {
    id: "direct_answer_near_top",
    category: "aeo",
    title: "Direct answer in first 60 words",
    description:
      "A clear, standalone paragraph that directly answers the main question or states the core value appears within the first 60 words of the content body.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "question_style_headings",
    category: "aeo",
    title: "Question-style headings",
    description:
      'At least two H2 or H3 headings are phrased as questions (e.g. "What is X?", "How does Y work?", "Why should I use Z?"). This makes content extraction by AI easier.',
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "short_paragraphs_and_lists",
    category: "aeo",
    title: "Short paragraphs and bullet lists",
    description:
      "Paragraphs are 2–4 sentences. Bullet or numbered lists are used where appropriate. Dense walls of text are absent.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "named_sources_citations",
    category: "geo",
    title: "Named sources and citations",
    description:
      'Statistics and claims are attributed to named sources (e.g. "According to Gartner...", "A 2024 study by MIT found..."). Vague or unsourced claims are flagged.',
    impact: "high",
    weight: 0.25,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
  {
    id: "author_and_date",
    category: "geo",
    title: "Author and publish date present",
    description:
      "A named author and a publish or last-updated date are visible in the content. These are core E-E-A-T signals that AI models use to assess credibility.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["blog", "product", "landing", "howto", "news"],
  },
];

// ─── Blog post criteria ───────────────────────────────────────────────────────

const BLOG: Criterion[] = [
  {
    id: "faq_section",
    category: "aeo",
    title: "FAQ section present",
    description:
      "A dedicated FAQ or Q&A section with at least 3 questions and answers. This enables FAQPage schema markup and is one of the strongest AEO signals.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["blog"],
  },
  {
    id: "concept_definitions",
    category: "aeo",
    title: "Key concepts explicitly defined",
    description:
      "Key terms and concepts are defined clearly on first use and used consistently throughout. Definition-dense content is cited 32% more often by AI models.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["blog"],
  },
  {
    id: "topical_depth",
    category: "geo",
    title: "Topical depth and comprehensiveness",
    description:
      "The article covers the topic in sufficient depth (800+ words recommended) and addresses the sub-questions a reader would naturally have.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["blog"],
  },
  {
    id: "expert_attribution",
    category: "geo",
    title: "Expert quotes or original data",
    description:
      "Article includes expert quotes with full attribution, or original research or data points that make it citation-worthy beyond formatting alone.",
    impact: "medium",
    weight: 0.25,
    contentTypes: ["blog"],
  },
];

// ─── Product page criteria ────────────────────────────────────────────────────

const PRODUCT: Criterion[] = [
  {
    id: "product_schema_signals",
    category: "aeo",
    title: "Product schema signals present",
    description:
      "Content clearly states the product name, key features, pricing or price range, and availability — the fields required for Product schema markup.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["product"],
  },
  {
    id: "product_faq",
    category: "aeo",
    title: "Purchase-decision FAQ",
    description:
      "A FAQ section addresses common buyer questions: compatibility, return policy, use cases, sizing, or shipping. Enables FAQPage schema.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["product"],
  },
  {
    id: "review_signals",
    category: "geo",
    title: "Review and rating signals",
    description:
      "Aggregate rating, review count, or customer testimonials are present and clearly attributed. AI models weight these as credibility signals.",
    impact: "medium",
    weight: 0.30,
    contentTypes: ["product"],
  },
  {
    id: "product_description_prose",
    category: "geo",
    title: "Product described in natural language prose",
    description:
      "The product is described in full sentences, not just spec tables. AI models extract natural language passages — raw spec rows alone are not cited.",
    impact: "medium",
    weight: 0.25,
    contentTypes: ["product"],
  },
];

// ─── Landing page criteria ────────────────────────────────────────────────────

const LANDING: Criterion[] = [
  {
    id: "value_proposition_clear",
    category: "aeo",
    title: "Value proposition in first 60 words",
    description:
      "What the service or offer is, who it is for, and what problem it solves is stated clearly in the first 60 words.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["landing"],
  },
  {
    id: "conversion_faq",
    category: "aeo",
    title: "Conversion-focused FAQ",
    description:
      "A FAQ section addresses objections and decision-stage questions: pricing, process, timelines, guarantees, or cancellation. Enables FAQPage schema.",
    impact: "high",
    weight: 0.20,
    contentTypes: ["landing"],
  },
  {
    id: "entity_consistency",
    category: "geo",
    title: "Consistent entity identity",
    description:
      "The company name, description, and service claims are consistent throughout. Contradictions between headings, body, and CTAs reduce AI citation confidence.",
    impact: "medium",
    weight: 0.30,
    contentTypes: ["landing"],
  },
  {
    id: "trust_signals",
    category: "geo",
    title: "Trust signals present",
    description:
      "Named customer testimonials, partner logos, case studies, or analyst recognition are present with attribution. These are primary GEO signals for service pages.",
    impact: "medium",
    weight: 0.25,
    contentTypes: ["landing"],
  },
];

// ─── How-to guide criteria ────────────────────────────────────────────────────

const HOWTO: Criterion[] = [
  {
    id: "numbered_steps",
    category: "aeo",
    title: "Numbered steps present",
    description:
      "Instructions are formatted as a numbered list. Each step is a self-contained sentence or short paragraph that stands alone for AI extraction.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["howto"],
  },
  {
    id: "tools_time_callout",
    category: "aeo",
    title: "Tools, materials, or time estimate stated",
    description:
      "Required tools, materials, prerequisites, or an estimated completion time are explicitly stated — ideally near the top. AI agents extract these as structured parameters.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["howto"],
  },
  {
    id: "howto_faq",
    category: "aeo",
    title: "Troubleshooting or variation FAQ",
    description:
      "A FAQ or troubleshooting section addresses common mistakes, edge cases, or variations of the procedure.",
    impact: "medium",
    weight: 0.15,
    contentTypes: ["howto"],
  },
  {
    id: "howto_depth",
    category: "geo",
    title: "Comprehensive step coverage",
    description:
      "Every step is explained with enough detail that a beginner could follow it. Vague steps like 'configure your settings' without specifics are flagged.",
    impact: "high",
    weight: 0.35,
    contentTypes: ["howto"],
  },
];

// ─── News / editorial criteria ────────────────────────────────────────────────

const NEWS: Criterion[] = [
  {
    id: "news_freshness",
    category: "geo",
    title: "Publish date and freshness signals",
    description:
      "A visible publish or last-updated date is present. For time-sensitive topics this is critical — Perplexity cites content published within 30 days at 3x the rate of older content.",
    impact: "high",
    weight: 0.30,
    contentTypes: ["news"],
  },
  {
    id: "named_source_quotes",
    category: "geo",
    title: "Named sources with direct quotes",
    description:
      "At least one named person or organisation is quoted directly with attribution. Anonymous sources are flagged as weaker GEO signals.",
    impact: "high",
    weight: 0.25,
    contentTypes: ["news"],
  },
  {
    id: "news_schema_signals",
    category: "aeo",
    title: "NewsArticle schema signals",
    description:
      "Content has a clear headline, byline, dateline, and organisation name — the fields required for NewsArticle schema markup.",
    impact: "medium",
    weight: 0.20,
    contentTypes: ["news"],
  },
  {
    id: "news_answer_lede",
    category: "aeo",
    title: "Answer-first lede (who, what, when, where)",
    description:
      "The opening paragraph answers the essential who, what, when, and where of the story within 60 words — standard inverted pyramid structure.",
    impact: "high",
    weight: 0.15,
    contentTypes: ["news"],
  },
];

// ─── Internal map ─────────────────────────────────────────────────────────────

const TYPE_CRITERIA: Record<ContentType, Criterion[]> = {
  blog: BLOG,
  product: PRODUCT,
  landing: LANDING,
  howto: HOWTO,
  news: NEWS,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns criteria for a specific content type: shared criteria first,
 * then type-specific criteria.
 */
export function getCriteria(contentType: ContentType): Criterion[] {
  return [...SHARED, ...TYPE_CRITERIA[contentType]];
}

/**
 * Returns every criterion across all types, deduplicated.
 * Used in the classify prompt so Claude can evaluate after detecting the content type.
 */
export function getAllCriteria(): Criterion[] {
  const seen = new Set<string>();
  const all: Criterion[] = [];
  for (const list of [SHARED, ...Object.values(TYPE_CRITERIA)]) {
    for (const c of list) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        all.push(c);
      }
    }
  }
  return all;
}
