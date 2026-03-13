import "server-only";

/**
 * Fetches a URL and returns its content as clean markdown.
 * Uses Jina AI Reader — free, no API key required.
 * Replaces the old Firecrawl integration.
 */
export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/markdown" },
  });

  if (!response.ok) {
    throw new Error(`Jina scrape failed with status ${response.status}`);
  }

  const markdown = await response.text();
  if (!markdown?.trim()) {
    throw new Error("No content returned from URL");
  }

  return markdown;
}
