/**
 * Notifications API
 *
 * GET    /api/notifications         → List recent notifications (unread first)
 * GET    /api/notifications/count   → Unread count
 * POST   /api/notifications/read    → Mark notification(s) as read
 * POST   /api/notifications/read-all → Mark all as read
 * POST   /api/notifications         → Create a notification (internal use)
 */

import { Router, type Request, type Response } from "express";
import db from "../db/database.js";
import { broadcast } from "./events.js";

const router = Router();

// GET /api/notifications — recent notifications + open actions
router.get("/", (req: Request, res: Response) => {
  const region = req.query.region as string | undefined;
  const country = req.query.country as string | undefined;

  // Region filter clause for opportunities
  const regionClause = region ? "AND o.region = ?" : country ? "AND o.country = ?" : "";
  const regionParam = region || country || null;

  const notifRows = regionParam
    ? (db
        .prepare(
          `SELECT n.id, n.type, n.title, n.message, n.opportunityId, n.empId, n.isRead, n.createdAt FROM user_notifications n LEFT JOIN assets o ON o.opportunityId = n.opportunityId LEFT JOIN user_assets uo ON uo.opportunityId = n.opportunityId WHERE n.isRead = 0 AND (o.region = ? OR o.country = ? OR uo.opportunityId IS NOT NULL) ORDER BY n.createdAt DESC LIMIT 50`
        )
        .all(regionParam, regionParam) as any[])
    : (db
        .prepare(
          "SELECT id, type, title, message, opportunityId, empId, isRead, createdAt FROM user_notifications WHERE isRead = 0 ORDER BY createdAt DESC LIMIT 50"
        )
        .all() as any[]);

  // Include open actions as virtual notifications (filtered by region)
  const actionQuery = `SELECT a.id, a.opportunityId, a.description, a.owner, a.dueDate, a.status, a.createdAt, COALESCE(o.opportunity, uo.opportunity) as oppName, COALESCE(o.account, uo.account) as account FROM user_actions a LEFT JOIN assets o ON o.opportunityId = a.opportunityId LEFT JOIN user_assets uo ON uo.opportunityId = a.opportunityId WHERE a.status != 'done' ${regionParam ? `AND (o.region = ? OR o.country = ? OR uo.opportunityId IS NOT NULL)` : ""} ORDER BY a.dueDate ASC`;
  const actionRows = regionParam
    ? (db.prepare(actionQuery).all(regionParam, regionParam) as any[])
    : (db.prepare(actionQuery).all() as any[]);

  const actionNotifs = actionRows.map((a: any) => ({
    id: `action_${a.id}`,
    type: "open_action",
    title: a.description || "Action",
    message: `${a.owner || ""}${a.dueDate ? ` · Échéance ${a.dueDate.slice(8, 10)}/${a.dueDate.slice(5, 7)}` : ""}${a.oppName ? ` · ${a.oppName}` : ""}`,
    opportunityId: a.opportunityId,
    isRead: 0,
    createdAt: a.createdAt || a.dueDate || "",
    _isAction: true,
    _actionStatus: a.status,
  }));

  res.json({ notifications: [...actionNotifs, ...notifRows] });
});

// GET /api/notifications/count — unread count (user_notifications + open actions)
router.get("/count", (req: Request, res: Response) => {
  const region = req.query.region as string | undefined;
  const country = req.query.country as string | undefined;
  const regionParam = region || country || null;

  const notifCount = regionParam
    ? (
        db
          .prepare(
            `SELECT COUNT(*) as count FROM user_notifications n LEFT JOIN assets o ON o.opportunityId = n.opportunityId LEFT JOIN user_assets uo ON uo.opportunityId = n.opportunityId WHERE n.isRead = 0 AND (o.region = ? OR o.country = ? OR uo.opportunityId IS NOT NULL)`
          )
          .get(regionParam, regionParam) as any
      )?.count || 0
    : (db.prepare("SELECT COUNT(*) as count FROM user_notifications WHERE isRead = 0").get() as any)?.count || 0;

  const actionQuery = regionParam
    ? `SELECT COUNT(*) as count FROM user_actions a LEFT JOIN assets o ON o.opportunityId = a.opportunityId LEFT JOIN user_assets uo ON uo.opportunityId = a.opportunityId WHERE a.status != 'done' AND (o.region = ? OR o.country = ? OR uo.opportunityId IS NOT NULL)`
    : `SELECT COUNT(*) as count FROM user_actions WHERE status != 'done'`;
  const actionCount = regionParam
    ? (db.prepare(actionQuery).get(regionParam, regionParam) as any)?.count || 0
    : (db.prepare(actionQuery).get() as any)?.count || 0;

  res.json({ count: notifCount + actionCount });
});

// POST /api/notifications/read — mark specific notification(s) as read
router.post("/read", (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE user_notifications SET isRead = 1 WHERE id IN (${placeholders})`).run(...ids);
  res.json({ success: true });
});

// POST /api/notifications/read-all — mark all as read
router.post("/read-all", (_req: Request, res: Response) => {
  db.prepare("UPDATE user_notifications SET isRead = 1 WHERE isRead = 0").run();
  res.json({ success: true });
});

// ── Notification types ──

export const NOTIFICATION_TYPES = {
  status_change: "status_change",
  action: "action",
  opportunity: "opportunity",
  staffing_need: "staffing_need",
  crm_update: "crm_update",
  open_action: "open_action",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ── Helper: create notification + broadcast SSE ──

export function createNotification(
  type: NotificationType,
  title: string,
  message?: string,
  opportunityId?: string,
  empId?: string
) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO user_notifications (type, title, message, opportunityId, empId, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(type, title, message || null, opportunityId || null, empId || null, now);
  broadcast("notification", { id: result.lastInsertRowid, type, title, message, opportunityId, empId, createdAt: now });
}

// Auto-cleanup old notifications (>90 days) on module load
try {
  const cleaned = db
    .prepare("DELETE FROM user_notifications WHERE createdAt < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')")
    .run();
  if (cleaned.changes > 0) console.log(`[notifications] Cleaned ${cleaned.changes} old entries`);
} catch {
  /* table might not exist yet */
}

export default router;
