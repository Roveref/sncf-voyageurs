/**
 * Account logo resolution via Brandfetch.
 *
 * GET /api/logos/resolve?name=BNP+Paribas
 *   → { domain, logoUrl, status }
 *
 * GET /api/logos/bulk
 *   → { [accountName]: { domain, logoUrl } }  (all cached entries)
 *
 * Flow: account name → Brandfetch Search API → domain → CDN logo URL → cache in SQLite
 */

import { Router, type Request, type Response } from "express";
import db from "../db/database.js";
import { log } from "../utils/logger.js";

const router = Router();

const BRANDFETCH_CLIENT_ID = process.env.BRANDFETCH_CLIENT_ID || "";

// ── Helpers ──

function buildLogoUrl(domain: string): string {
  if (!BRANDFETCH_CLIENT_ID) return `https://cdn.brandfetch.io/${domain}/w/80/icon`;
  return `https://cdn.brandfetch.io/${domain}/w/80/icon?c=${BRANDFETCH_CLIENT_ID}`;
}

/** Legal suffixes stripped before search to improve matching */
const LEGAL_SUFFIXES =
  /\b(S\.?A\.?S?\.?|S\.?A\.?R\.?L\.?|GmbH|AG|Ltd\.?|Inc\.?|Corp\.?|PLC|N\.?V\.?|B\.?V\.?|SE|S\.?p\.?A\.?|S\.?r\.?l\.?|EURL|SNC|&\s*Co\.?|Group|Groupe|France|Europe|International|Deutschland|UK|US)\s*$/gi;

/** Generate progressively simpler search candidates from a CRM account name */
function buildSearchCandidates(raw: string): string[] {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (!trimmed) return candidates;

  // 1. Full name
  candidates.push(trimmed);

  // 2. Strip legal suffixes (may need multiple passes: "BNP Paribas SA France" → "BNP Paribas")
  let stripped = trimmed;
  for (let i = 0; i < 3; i++) {
    const next = stripped.replace(LEGAL_SUFFIXES, "").trim();
    if (next === stripped) break;
    stripped = next;
  }
  if (stripped !== trimmed && stripped.length >= 2) candidates.push(stripped);

  // 3. First 2-3 words (handles "Société Générale Corporate & Investment Banking" → "Société Générale")
  const words = stripped.split(/\s+/);
  if (words.length > 3) candidates.push(words.slice(0, 3).join(" "));
  if (words.length > 2) candidates.push(words.slice(0, 2).join(" "));

  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

/** Single Brandfetch search call — trusts Brandfetch ranking (_score), only promotes claimed brands */
async function brandfetchSearch(query: string): Promise<{ domain: string; name: string } | null> {
  try {
    const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}?c=${BRANDFETCH_CLIENT_ID}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ domain?: string; name?: string; _score?: number; claimed?: boolean }>;
    if (results.length === 0) return null;
    // Brandfetch already sorts by relevance (_score). Only override if a claimed brand exists.
    const withDomain = results.filter((r) => r.domain);
    const claimed = withDomain.find((r) => r.claimed);
    const best = claimed || withDomain[0];
    return best?.domain ? { domain: best.domain, name: best.name || query } : null;
  } catch {
    return null;
  }
}

/** Progressive search: tries full name, then stripped, then shorter forms */
async function searchBrandfetch(name: string): Promise<{ domain: string; name: string } | null> {
  if (!BRANDFETCH_CLIENT_ID) {
    log("logos", `No BRANDFETCH_CLIENT_ID configured — skipping search for "${name}"`);
    return null;
  }

  const candidates = buildSearchCandidates(name);
  for (const candidate of candidates) {
    const result = await brandfetchSearch(candidate);
    if (result) {
      log("logos", `Resolved "${name}" → "${result.domain}" (via query "${candidate}")`);
      return result;
    }
  }
  log("logos", `No match for "${name}" after ${candidates.length} attempts: [${candidates.join(", ")}]`);
  return null;
}

// ── Routes ──

/**
 * Resolve a single account name → logo URL.
 * Checks cache first, then calls Brandfetch Search API.
 */
router.get("/resolve", async (req: Request, res: Response) => {
  const name = String(req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "name query parameter required" });

  // Check cache
  const cached = db.prepare("SELECT domain, logoUrl, status FROM var_logos WHERE accountName = ?").get(name) as
    | { domain: string | null; logoUrl: string | null; status: string }
    | undefined;

  if (cached && cached.status !== "pending") {
    return res.json({ domain: cached.domain, logoUrl: cached.logoUrl, status: cached.status });
  }

  // Search Brandfetch
  const result = await searchBrandfetch(name);
  const now = new Date().toISOString();

  if (result) {
    const logoUrl = buildLogoUrl(result.domain);
    db.prepare(
      "INSERT INTO var_logos (accountName, domain, logoUrl, status, updatedAt) VALUES (?, ?, ?, 'found', ?) ON CONFLICT(accountName) DO UPDATE SET domain=excluded.domain, logoUrl=excluded.logoUrl, status='found', updatedAt=excluded.updatedAt"
    ).run(name, result.domain, logoUrl, now);
    return res.json({ domain: result.domain, logoUrl, status: "found" });
  } else {
    db.prepare(
      "INSERT INTO var_logos (accountName, domain, logoUrl, status, updatedAt) VALUES (?, NULL, NULL, 'not_found', ?) ON CONFLICT(accountName) DO UPDATE SET status='not_found', updatedAt=excluded.updatedAt"
    ).run(name, now);
    return res.json({ domain: null, logoUrl: null, status: "not_found" });
  }
});

/**
 * Bulk return all cached logo entries (for frontend hydration).
 */
router.get("/bulk", (_req: Request, res: Response) => {
  const rows = db
    .prepare("SELECT accountName, domain, logoUrl, status FROM var_logos WHERE status = 'found'")
    .all() as Array<{ accountName: string; domain: string; logoUrl: string; status: string }>;
  const map: Record<string, { domain: string; logoUrl: string }> = {};
  for (const r of rows) {
    map[r.accountName] = { domain: r.domain, logoUrl: r.logoUrl };
  }
  res.json(map);
});

/**
 * Manual override: set domain for an account (bypass Brandfetch search).
 */
router.put("/override", (req: Request, res: Response) => {
  const { name, domain } = req.body;
  if (!name || !domain) return res.status(400).json({ error: "name and domain required" });
  const logoUrl = buildLogoUrl(domain);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO var_logos (accountName, domain, logoUrl, status, updatedAt) VALUES (?, ?, ?, 'manual', ?) ON CONFLICT(accountName) DO UPDATE SET domain=excluded.domain, logoUrl=excluded.logoUrl, status='manual', updatedAt=excluded.updatedAt"
  ).run(name, domain, logoUrl, now);
  res.json({ domain, logoUrl, status: "manual" });
});

/**
 * Retry all not_found entries (useful after improving search logic).
 */
router.post("/retry", async (_req: Request, res: Response) => {
  const notFound = db.prepare("SELECT accountName FROM var_logos WHERE status = 'not_found'").all() as Array<{
    accountName: string;
  }>;
  db.prepare("DELETE FROM var_logos WHERE status = 'not_found'").run();
  res.json({
    cleared: notFound.length,
    message: `Cleared ${notFound.length} not_found entries — they will be re-resolved on next access`,
  });
});

export default router;
