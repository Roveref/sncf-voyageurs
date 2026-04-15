/**
 * Routes /api/config/* — CRUD for var_config entries
 *
 * GET    /api/config              → All entries grouped by category
 * PUT    /api/config/:category/:key → Update a single entry
 * POST   /api/config/:category    → Create a new entry
 * DELETE /api/config/:category/:key → Delete an entry
 */

import { Router, Request, Response } from "express";
import db from "../db/database.js";
import { log, error } from "../utils/logger.js";
import { broadcast } from "./events.js";

/** Categories where values must be valid numbers */
const NUMERIC_CATEGORIES = new Set(["hours", "target", "threshold"]);
/** Max allowed string length for config values */
const MAX_VALUE_LENGTH = 500;

const router = Router();

// ── GET /api/config ──

router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT category, key, value FROM var_config ORDER BY category, key").all() as {
      category: string;
      key: string;
      value: string;
    }[];

    // Group by category
    const grouped: Record<string, { key: string; value: string }[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push({ key: row.key, value: row.value });
    }

    res.json({ categories: grouped });
  } catch (err) {
    error("config", "GET /api/config failed:", err);
    res.status(500).json({ error: "Failed to fetch config", details: String(err) });
  }
});

// ── PUT /api/config/:category/:key ──

router.put("/:category/:key", (req: Request, res: Response) => {
  try {
    const { category, key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      res.status(400).json({ error: "Missing 'value' in request body" });
      return;
    }

    const existing = db.prepare("SELECT 1 FROM var_config WHERE category = ? AND key = ?").get(category, key);

    if (!existing) {
      res.status(404).json({ error: `Entry not found: ${category}/${key}` });
      return;
    }

    const strValue = String(value);
    if (strValue.length > MAX_VALUE_LENGTH) {
      res.status(400).json({ error: `Value too long (max ${MAX_VALUE_LENGTH} chars)` });
      return;
    }
    if (NUMERIC_CATEGORIES.has(String(category)) && isNaN(Number(strValue))) {
      res.status(400).json({ error: `Category "${category}" requires a numeric value` });
      return;
    }

    db.prepare("UPDATE var_config SET value = ? WHERE category = ? AND key = ?").run(
      strValue,
      String(category),
      String(key)
    );

    log("config", `Updated ${category}/${key}`);
    broadcast("config-updated", { category: String(category), key: String(key), value: strValue });
    res.json({ success: true, category, key, value: strValue });
  } catch (err) {
    error("config", "PUT failed:", err);
    res.status(500).json({ error: "Failed to update config", details: String(err) });
  }
});

// ── POST /api/config/:category ──

router.post("/:category", (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { key, value } = req.body;

    if (!key || value === undefined || value === null) {
      res.status(400).json({ error: "Missing 'key' or 'value' in request body" });
      return;
    }

    const existing = db.prepare("SELECT 1 FROM var_config WHERE category = ? AND key = ?").get(category, key);

    if (existing) {
      res.status(409).json({ error: `Entry already exists: ${category}/${key}` });
      return;
    }

    const strValue = String(value);
    if (strValue.length > MAX_VALUE_LENGTH) {
      res.status(400).json({ error: `Value too long (max ${MAX_VALUE_LENGTH} chars)` });
      return;
    }
    if (NUMERIC_CATEGORIES.has(String(category)) && isNaN(Number(strValue))) {
      res.status(400).json({ error: `Category "${category}" requires a numeric value` });
      return;
    }

    db.prepare("INSERT INTO var_config (category, key, value) VALUES (?, ?, ?)").run(
      String(category),
      String(key),
      strValue
    );

    log("config", `Created ${category}/${key}`);
    broadcast("config-updated", { category: String(category), key: String(key), value: strValue });
    res.json({ success: true, category, key: String(key), value: strValue });
  } catch (err) {
    error("config", "POST failed:", err);
    res.status(500).json({ error: "Failed to create config entry", details: String(err) });
  }
});

// ── DELETE /api/config/:category/:key ──

router.delete("/:category/:key", (req: Request, res: Response) => {
  try {
    const { category, key } = req.params;

    const result = db.prepare("DELETE FROM var_config WHERE category = ? AND key = ?").run(category, key);

    if (result.changes === 0) {
      res.status(404).json({ error: `Entry not found: ${category}/${key}` });
      return;
    }

    log("config", `Deleted ${category}/${key}`);
    res.json({ success: true, category, key });
  } catch (err) {
    error("config", "DELETE failed:", err);
    res.status(500).json({ error: "Failed to delete config entry", details: String(err) });
  }
});

export default router;
