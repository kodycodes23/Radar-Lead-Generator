import { ApifyClient } from "apify-client";
import { decodeHtmlEntities } from "@/lib/decodeHtmlEntities";
import type { DiscoveryOutcome, DiscoveryResult } from "./apify";

// A second, optional discovery path alongside apify.ts's google-search-scraper
// -- a structured company database, filtered by SIC (Standard Industrial
// Classification) code and country, rather than free-text search. Verified
// with a real paid test run before wiring in: organization-level fields only
// (no personal/individual data, confirmed empirically, not just from docs),
// and the sic_codes filter produces real topical precision (the free-text
// `keywords` field on this actor does not -- confirmed by a separate real
// test that ignored it entirely). See aat-c3-week-5-lead-agent/PRD.md
// "Apify Usage Limits".
const DISCOVERY_ACTOR_ID = "braveleads/company-organization-finder-apollo-linkedin";

// This actor bills a flat ~$0.18 minimum per call (100 leads minimum,
// enforced by the actor's own input validation) regardless of how few are
// actually used -- unlike google-search-scraper's ~$0.006 per small call.
// Always request exactly the minimum; the caller (the tool handler) truncates
// to whatever of the run's discovery budget remains and refunds the rest,
// same pattern as discoverCompanies in apify.ts.
const MIN_RESULTS_PER_CALL = 100;

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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
 * Runs one structured company-database search filtered by SIC code(s) and
 * optionally country. The caller is responsible for truncating/deduping
 * against the run's remaining company-discovery budget, same as
 * discoverCompanies in apify.ts.
 */
export async function discoverCompaniesByIndustryCode(
  sicCodes: string[],
  countries?: string[]
): Promise<DiscoveryOutcome> {
  const run = await getClient()
    .actor(DISCOVERY_ACTOR_ID)
    .call({
      totalResults: MIN_RESULTS_PER_CALL,
      sic_codes: sicCodes,
      ...(countries && countries.length > 0 ? { companyCountry: countries } : {}),
    });

  const { items } = await getClient().dataset(run.defaultDatasetId).listItems();

  const results: DiscoveryResult[] = [];
  for (const item of items as Array<Record<string, unknown>>) {
    const websiteUrl = typeof item.organizationWebsite === "string" ? item.organizationWebsite : null;
    const name = typeof item.organizationName === "string" ? item.organizationName : null;
    // Skips a real, observed data-quality artifact: this actor occasionally
    // pushes its own log message into the dataset as a fake record (no
    // website field, name is a status string, not a company).
    if (!websiteUrl || !name) continue;
    const domain = extractDomain(websiteUrl);
    if (!domain) continue;

    const industry = typeof item.organizationIndustry === "string" ? item.organizationIndustry : "";
    const size = typeof item.organizationSize === "string" ? item.organizationSize : "";
    const country = typeof item.organizationCountry === "string" ? item.organizationCountry : "";

    results.push({
      title: decodeHtmlEntities(name),
      url: websiteUrl,
      domain,
      description: decodeHtmlEntities([industry, size && `${size} employees`, country].filter(Boolean).join(" -- ")),
    });
  }

  return { results, costUsd: run.usageTotalUsd ?? null };
}
