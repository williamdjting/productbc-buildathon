import "server-only";
import type { MetadataGrade, MetadataReport } from "./types";

// ─── Internal raw metadata shape ──────────────────────────────────────────────

interface RawMetadata {
  title: string | null;
  metaDescription: string | null;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  canonical: string | null;
  jsonLd: object[];
}

// ─── HTML parsing ─────────────────────────────────────────────────────────────

function getAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}=["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseHead(html: string): string {
  const m = html.match(/<head[\s\S]*?<\/head>/i);
  return m ? m[0] : html.slice(0, 12000);
}

function parseMetadata(html: string): RawMetadata {
  const head = parseHead(html);

  // Title
  const titleMatch = head.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // All <meta> tags
  const metaTags = [...head.matchAll(/<meta\s+([^>]+)>/gi)];
  const openGraph: Record<string, string> = {};
  const twitterCard: Record<string, string> = {};
  let metaDescription: string | null = null;

  for (const match of metaTags) {
    const tag = match[1];
    const name = getAttr(tag, "name");
    const property = getAttr(tag, "property");
    const content = getAttr(tag, "content");
    if (!content) continue;

    if (name?.toLowerCase() === "description") {
      metaDescription = content;
    } else if (property?.toLowerCase().startsWith("og:")) {
      openGraph[property.toLowerCase()] = content;
    } else if (name?.toLowerCase().startsWith("twitter:")) {
      twitterCard[name.toLowerCase()] = content;
    }
  }

  // Canonical — handle both attribute orders
  const canonMatch =
    head.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i) ??
    head.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonical = canonMatch ? canonMatch[1] : null;

  // JSON-LD blocks
  const jsonLd: object[] = [];
  for (const m of head.matchAll(
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      jsonLd.push(JSON.parse(m[1]));
    } catch {
      // invalid JSON-LD — skip
    }
  }

  return { title, metaDescription, openGraph, twitterCard, canonical, jsonLd };
}

// ─── Grading ──────────────────────────────────────────────────────────────────

function gradeMetadata(raw: RawMetadata): MetadataGrade[] {
  const grades: MetadataGrade[] = [];

  // Title tag
  if (!raw.title) {
    grades.push({
      id: "title_tag",
      title: "Title tag",
      status: "fail",
      reason: "No <title> tag detected.",
      suggestion: "Add a <title> with your primary keyword in the first 60 characters.",
    });
  } else if (raw.title.length < 30 || raw.title.length > 70) {
    grades.push({
      id: "title_tag",
      title: "Title tag",
      status: "warn",
      reason: `Title is ${raw.title.length} chars — ideal is 30–70.`,
      suggestion: `Trim or expand to 30–70 characters. Current: "${raw.title}"`,
    });
  } else {
    grades.push({
      id: "title_tag",
      title: "Title tag",
      status: "pass",
      reason: `Title present at ${raw.title.length} characters.`,
      suggestion: "",
    });
  }

  // Meta description
  if (!raw.metaDescription) {
    grades.push({
      id: "meta_description",
      title: "Meta description",
      status: "fail",
      reason: "No <meta name=\"description\"> tag found.",
      suggestion: "Add a meta description of 120–160 characters that summarises the page content.",
    });
  } else if (raw.metaDescription.length < 120 || raw.metaDescription.length > 160) {
    grades.push({
      id: "meta_description",
      title: "Meta description",
      status: "warn",
      reason: `Meta description is ${raw.metaDescription.length} chars — ideal is 120–160.`,
      suggestion: `Adjust to 120–160 characters.`,
    });
  } else {
    grades.push({
      id: "meta_description",
      title: "Meta description",
      status: "pass",
      reason: `Meta description present at ${raw.metaDescription.length} characters.`,
      suggestion: "",
    });
  }

  // Canonical
  if (!raw.canonical) {
    grades.push({
      id: "canonical",
      title: "Canonical URL",
      status: "warn",
      reason: "No canonical link tag found.",
      suggestion: 'Add <link rel="canonical" href="..."> to prevent duplicate-content issues.',
    });
  } else {
    grades.push({
      id: "canonical",
      title: "Canonical URL",
      status: "pass",
      reason: "Canonical link is present.",
      suggestion: "",
    });
  }

  // Open Graph completeness
  const hasOgTitle = "og:title" in raw.openGraph;
  const hasOgDesc = "og:description" in raw.openGraph;
  const hasOgImage = "og:image" in raw.openGraph;

  if (!hasOgTitle && !hasOgDesc && !hasOgImage) {
    grades.push({
      id: "og_complete",
      title: "Open Graph tags",
      status: "fail",
      reason: "No Open Graph tags found.",
      suggestion: "Add og:title, og:description, and og:image for social previews and AI knowledge-graph signals.",
    });
  } else if (!hasOgTitle || !hasOgDesc || !hasOgImage) {
    const missing = (
      [
        !hasOgTitle && "og:title",
        !hasOgDesc && "og:description",
        !hasOgImage && "og:image",
      ] as (string | false)[]
    ).filter(Boolean) as string[];
    grades.push({
      id: "og_complete",
      title: "Open Graph tags",
      status: "warn",
      reason: `Missing Open Graph tags: ${missing.join(", ")}.`,
      suggestion: `Add the missing tags: ${missing.join(", ")}.`,
    });
  } else {
    grades.push({
      id: "og_complete",
      title: "Open Graph tags",
      status: "pass",
      reason: "og:title, og:description, and og:image are all present.",
      suggestion: "",
    });
  }

  // Twitter / X card
  if (!("twitter:card" in raw.twitterCard)) {
    grades.push({
      id: "twitter_card",
      title: "Twitter / X card",
      status: "warn",
      reason: "No twitter:card meta tag found.",
      suggestion: 'Add <meta name="twitter:card" content="summary_large_image"> for rich previews.',
    });
  } else {
    grades.push({
      id: "twitter_card",
      title: "Twitter / X card",
      status: "pass",
      reason: "Twitter card tag is present.",
      suggestion: "",
    });
  }

  // JSON-LD presence
  if (raw.jsonLd.length === 0) {
    grades.push({
      id: "json_ld_present",
      title: "Structured data (JSON-LD)",
      status: "fail",
      reason: "No JSON-LD structured data found.",
      suggestion: "Add at least one JSON-LD block (Article, WebPage, or Product) so AI crawlers can understand your content type.",
    });
  } else {
    const types = raw.jsonLd
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b["@type"])
      .filter(Boolean)
      .join(", ");
    grades.push({
      id: "json_ld_present",
      title: "Structured data (JSON-LD)",
      status: "pass",
      reason: `${raw.jsonLd.length} JSON-LD block(s) found${types ? `: ${types}` : ""}.`,
      suggestion: "",
    });

    // FAQPage schema — only graded when JSON-LD is present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasFaq = raw.jsonLd.some((b: any) => {
      if (b["@type"] === "FAQPage") return true;
      if (Array.isArray(b["@graph"]))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return b["@graph"].some((g: any) => g["@type"] === "FAQPage");
      return false;
    });

    if (!hasFaq) {
      grades.push({
        id: "faqpage_schema",
        title: "FAQPage schema",
        status: "warn",
        reason: "No FAQPage JSON-LD block found.",
        suggestion: "If the page has a Q&A section, add FAQPage schema to unlock AI-featured answer eligibility.",
      });
    } else {
      grades.push({
        id: "faqpage_schema",
        title: "FAQPage schema",
        status: "pass",
        reason: "FAQPage structured data is present.",
        suggestion: "",
      });
    }
  }

  return grades;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  json_ld_present: 0.25,
  og_complete: 0.20,
  meta_description: 0.20,
  title_tag: 0.15,
  canonical: 0.10,
  faqpage_schema: 0.05,
  twitter_card: 0.05,
};

function scoreGrades(grades: MetadataGrade[]): number {
  let total = 0;
  let weightSum = 0;
  for (const g of grades) {
    const w = WEIGHTS[g.id] ?? 0.05;
    weightSum += w;
    if (g.status === "pass") total += w;
    else if (g.status === "warn") total += w * 0.5;
  }
  return weightSum > 0 ? Math.round((total / weightSum) * 100) : 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the raw HTML of a URL, parses <head> metadata, and grades each signal.
 * Throws if the page cannot be fetched within 10 seconds.
 */
export async function fetchAndGradeMetadata(url: string): Promise<MetadataReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AEOChecker/1.0; +https://aeo.tools)",
        Accept: "text/html",
      },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const raw = parseMetadata(html);
    const grades = gradeMetadata(raw);
    const score = scoreGrades(grades);

    return { score, grades };
  } catch (err) {
    clearTimeout(timer);
    throw new Error(
      `Metadata fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
