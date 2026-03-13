# Cloudflare Browser Rendering — URL Crawler Service Specification

A backend service that uses the Cloudflare `/crawl` endpoint to discover and return a list of all URLs from a starting URL. No AI extraction, no page content responses — only URL discovery. Designed to be called directly from a frontend.

---

## Overview

This service acts as a thin proxy between a frontend and the Cloudflare Browser Rendering `/crawl` API. It handles credential security (API tokens never exposed to the browser), parameter validation, and returns a clean URL list to the client.

The workflow is fully asynchronous and follows Cloudflare's two-step design:

1. The frontend sends a crawl request to the backend → the backend forwards it to Cloudflare and returns a **job ID**
2. The frontend polls the backend with that job ID → the backend fetches status from Cloudflare and returns the current URL list until the job is complete

---

## Architecture

```
Frontend (browser)
       │
       ▼
Backend Service  (Node.js / Cloudflare Worker)
       │
       ├── POST  /start-crawl         →   Cloudflare /crawl         (initiates job)
       ├── GET   /crawl-status/:jobId →   Cloudflare /crawl/:id     (polls results)
       └── DELETE /cancel-crawl/:jobId →  Cloudflare /crawl/:id     (cancels job)
```

---

## Prerequisites

- A Cloudflare account on the **Workers Paid plan**
  - Free plan is limited to 10 minutes of browser time per day
- A **Cloudflare API Token** with `Browser Rendering: Edit` permission
  - Generated at: `https://dash.cloudflare.com/profile/api-tokens`
- Your **Cloudflare Account ID**
  - Found in the Cloudflare dashboard sidebar

---

## Environment Configuration

The following secrets must be configured on the backend and must never be exposed to the frontend:

| Variable | Description |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account identifier |
| `CLOUDFLARE_API_TOKEN` | API token with Browser Rendering Edit permission |
| `PORT` | Port the backend listens on (local only) |

---

## Endpoints

### `POST /start-crawl`

Initiates a crawl job. Returns a job ID immediately — no page content is returned at this stage.

**Request body:**

| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `url` | string | — | ✅ | The starting URL to crawl from |
| `limit` | number | `1000` | — | Maximum number of pages to crawl |
| `depth` | number | `10` | — | Maximum link depth from the starting URL |
| `source` | string | `"all"` | — | URL discovery method — see Source Options below |

**Response:**

| Field | Type | Description |
|---|---|---|
| `jobId` | string | Unique identifier for the crawl job — used for all subsequent polling |
| `config` | object | Echo of the parameters used to start the job |

---

### `GET /crawl-status/:jobId`

Polls the status of a running crawl job and returns discovered URLs. Call this repeatedly until `jobStatus` is no longer `"running"`.

**URL parameters:**

| Param | Description |
|---|---|
| `jobId` | The job ID returned from `/start-crawl` |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `cursor` | string | — | Pagination cursor — pass this when the previous response included a `cursor` value |
| `limit` | number | `100` | Maximum records to return per page |
| `status` | string | — | Filter URLs by their crawl status — see URL Status Values below |

**Response:**

| Field | Type | Description |
|---|---|---|
| `jobId` | string | The job identifier |
| `jobStatus` | string | Current state of the crawl job — see Job Status Values below |
| `browserSecondsUsed` | number | Billable browser time consumed so far |
| `total` | number | Total URLs discovered by the crawler |
| `finished` | number | URLs that have been fully processed |
| `cursor` | string or null | Pagination cursor — present when there are more results to fetch |
| `urls` | array | List of URL objects — see URL Object below |

**URL object:**

| Field | Type | Description |
|---|---|---|
| `url` | string | The discovered URL |
| `status` | string | The crawl result for this URL — see URL Status Values below |
| `httpStatus` | number or null | HTTP response code returned when the URL was fetched |

---

### `DELETE /cancel-crawl/:jobId`

Cancels a job that is currently running. All queued URLs are cancelled immediately.

**URL parameters:**

| Param | Description |
|---|---|
| `jobId` | The job ID to cancel |

**Response:**

| Field | Type | Description |
|---|---|---|
| `jobId` | string | The cancelled job identifier |
| `cancelled` | boolean | Confirms the cancellation was accepted |

---

## Status Reference

### Job Status Values

| Status | Meaning | Action |
|---|---|---|
| `running` | Crawl is in progress | Continue polling |
| `completed` | All pages have been processed | Stop polling, collect results |
| `errored` | Job hit an unrecoverable error | Stop polling, inspect results |
| `cancelled_by_user` | Manually cancelled via DELETE | Stop polling |
| `cancelled_due_to_timeout` | Exceeded the 7-day maximum run time | Stop polling |
| `cancelled_due_to_limits` | Hit account browser-hour limits | Stop polling, check plan limits |

### URL Status Values

| Status | Meaning |
|---|---|
| `completed` | Page was successfully crawled |
| `disallowed` | Blocked by the site's `robots.txt` — URL is returned but was not crawled |
| `skipped` | Excluded by pattern filters or `modifiedSince` parameter |
| `queued` | Discovered but not yet processed — may appear mid-crawl |
| `errored` | Page failed to load |
| `cancelled` | Was queued when the job was cancelled |

---

## Adjustable Parameters

### `limit` — Maximum pages to crawl

Controls the total number of pages the crawler will process before stopping.

- Minimum: `1`
- Maximum: `100,000`
- Default: `1,000`

The crawler stops as soon as it reaches this number regardless of how many URLs it has discovered. If the site has fewer pages than the limit, the crawler finishes naturally.

Suggested values by use case:

| Use Case | Suggested Limit |
|---|---|
| Quick site audit | 100 |
| Standard crawl | 1,000 |
| Large documentation site | 10,000 |
| Full site archive | 100,000 |

---

### `depth` — Maximum link depth

Controls how many hops away from the starting URL the crawler will follow links.

- Minimum: `1`
- Maximum: `100,000`
- Default: `10`

A depth of `1` means only the links found on the starting page will be crawled. A depth of `2` adds the pages those links point to, and so on. Shallower depths complete faster and consume fewer resources.

Suggested values by use case:

| Use Case | Suggested Depth |
|---|---|
| Single page + direct links only | 1 |
| Shallow site audit | 2–3 |
| Standard multi-level site | 5–10 |
| Deep documentation or blog | 10+ |

---

### `source` — URL discovery method

Controls where the crawler looks for URLs to visit.

| Value | Behaviour | Best For |
|---|---|---|
| `"all"` | Uses both sitemaps and page links — **recommended** | Most sites, best coverage |
| `"sitemaps"` | Only crawls URLs listed in `sitemap.xml` or `sitemap_index.xml` | Structured sites with complete sitemaps |
| `"links"` | Only follows links found on crawled pages, ignores sitemaps | Sites without sitemaps |

When `"all"` is used, the crawler discovers URLs in this order:
1. The starting URL itself
2. URLs found in the site's sitemap
3. Links scraped from each crawled page that were not already in the sitemap

---

## Crawler Behavior

### `render: false` — Static HTML Only

This service always sets `render: false`. This means the crawler fetches raw HTML without launching a headless browser or executing JavaScript. It is significantly faster and is free during Cloudflare's current beta period for static crawls.

This is appropriate for any site where the content you need is present in the initial HTML response. Do not use this service for single-page applications or pages that load content dynamically via JavaScript.

### `robots.txt` Compliance

The Cloudflare crawler automatically reads and respects the target site's `robots.txt` file, including any `Crawl-delay` directives. URLs that are disallowed by `robots.txt` are not crawled but are still included in the results with `"status": "disallowed"`, so you have a full picture of what was discovered vs. what was skipped.

### Domain Scope

By default the crawler stays on the same domain as the starting URL. It does not follow links to subdomains or external domains unless explicitly configured to do so.

### Job Retention

Completed job results are available for **14 days** after the job finishes. After that, Cloudflare deletes the data. Jobs that are still running have a maximum lifetime of **7 days**, after which they are automatically cancelled.

---

## Frontend Polling Flow

The frontend is responsible for the polling loop. The recommended approach:

1. Call `POST /start-crawl` with the desired parameters → store the returned `jobId`
2. Wait a few seconds, then call `GET /crawl-status/:jobId`
3. Check `jobStatus` in the response
   - If `"running"` → wait and poll again
   - If anything else → the job is complete, stop polling
4. If the response includes a `cursor` value, call `GET /crawl-status/:jobId?cursor=...` to fetch the next page of results
5. Repeat step 4 until `cursor` is null
6. Filter the collected `urls` array by `status === "completed"` for the final usable URL list

Recommended polling interval: **5 seconds**. Polling too frequently does not speed up the crawl and adds unnecessary load.

---

## Billing Notes

| Component | Cost |
|---|---|
| Browser rendering (`render: false`) | **Free during beta** — runs on Cloudflare Workers, not a headless browser |
| Workers AI | **Not used** — this service returns URL lists only, no AI extraction |
| Workers Paid plan | Required — Free plan limited to 10 min/day browser time |

Once `render: false` exits beta, it will be billed under standard Cloudflare Workers pricing, which is significantly cheaper than browser-based rendering.
