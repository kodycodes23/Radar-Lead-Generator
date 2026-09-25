import { ApifyClient } from "apify-client";
import { decodeHtmlEntities } from "@/lib/decodeHtmlEntities";

// Company discovery only, via Apify's official pay-per-event Google Search
// Results Scraper (apify/google-search-scraper). It returns public SERP
// data (titles/URLs/snippets), never gated or authenticated content, and
// bills per result rather than a flat rental fee -- see
// aat-c3-week-5-lead-agent/PRD.md "Apify Usage Limits".
const DISCOVERY_ACTOR_ID = "apify/google-search-scraper";

export interface DiscoveryResult {
  title: string;
  url: string;
  domain: string;
  description: string;
}

export interface DiscoveryOutcome {
  results: DiscoveryResult[];
  costUsd: number | null;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Brand-name fragments for domains that repeatedly showed up in real
// discovery runs but are never themselves a candidate company: social/video
// platforms, job/career boards, and B2B directory/aggregator/review sites.
// Matched as a substring of the full hostname (not exact/subdomain match)
// specifically to catch regional and TLD variants of the same service --
// confirmed necessary by real evidence: a first version of this list using
// exact-domain matching let glassdoor.co.uk and BuiltIn's city-specific
// domains (builtinnyc.com, builtincolorado.com, ...) straight through.
// Doesn't generalize to every possible noise site (a search can still
// surface a one-off irrelevant result), but this durable, recurring set
// means the discovery budget goes to actual company websites far more often
// than before this filter existed.
const NOISE_DOMAIN_KEYWORDS = [
  // social / video platforms
  "youtube.com", "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
  "x.com", "tiktok.com", "pinterest.com", "reddit.com",
  // job boards / ATS / career sites
  "indeed.", "ziprecruiter.", "glassdoor.", "monster.com", "roberthalf.com",
  "careerbuilder.", "simplyhired.", "lever.co", "greenhouse.io", "builtin",
  "remoterocketship.com", "dailyremote.com", "showbizjobs.com", "bebee.com",
  "ambitionbox.com",
  // B2B directories / review / aggregator sites
  "clutch.co", "g2.com", "capterra.com", "trustpilot.com", "crunchbase.com",
  "goodfirms.co", "techbehemoths.com", "agencycluster.com", "designrush.com",
  "upcity.com", "digitalagencynetwork.com", "50pros.com", "themanifest.com",
  "sortlist.com",
  // general content / reference platforms
  "wikipedia.org", "quora.com", "medium.com", "yelp.com",
];

function isNoiseDomain(domain: string): boolean {
  return NOISE_DOMAIN_KEYWORDS.some((keyword) => domain.includes(keyword));
}

let client: ApifyClient | null = null;
function getClient() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN must be set (see .env.local.example).");
  }
  if (!client) client = new ApifyClient({ token });
  return client;
}

/**
 * Runs one Google Search discovery query, capped to a single results page
 * (~10 organic results) per call so cost per call stays small and
 * predictable. The caller (the discover_companies tool) is responsible for
 * truncating/deduping against the run's remaining company-discovery budget.
 */
export async function discoverCompanies(query: string): Promise<DiscoveryOutcome> {
  const run = await getClient().actor(DISCOVERY_ACTOR_ID).call({
    queries: query,
    maxPagesPerQuery: 1,
    countryCode: "us",
  });

  const { items } = await getClient().dataset(run.defaultDatasetId).listItems();

  const results: DiscoveryResult[] = [];
  for (const item of items as Array<Record<string, unknown>>) {
    const organic = Array.isArray(item.organicResults) ? item.organicResults : [];
    for (const r of organic as Array<Record<string, unknown>>) {
      const url = typeof r.url === "string" ? r.url : null;
      if (!url) continue;
      const domain = extractDomain(url);
      if (!domain || isNoiseDomain(domain)) continue;
      results.push({
        title: typeof r.title === "string" ? decodeHtmlEntities(r.title) : domain,
        url,
        domain,
        description: typeof r.description === "string" ? decodeHtmlEntities(r.description) : "",
      });
    }
  }

  return { results, costUsd: run.usageTotalUsd ?? null };
}
