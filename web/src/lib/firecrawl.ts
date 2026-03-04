import "server-only";
import FirecrawlApp from "@mendable/firecrawl-js";

let _client: FirecrawlApp | null = null;

export function getFirecrawlClient(): FirecrawlApp {
  if (!_client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }
    _client = new FirecrawlApp({ apiKey });
  }
  return _client;
}
