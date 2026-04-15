/**
 * Audit trail helper — logs actions to var_audit table.
 */

import db from "../db/database.js";

export function logAudit(
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
): void {
  try {
    db.prepare(
      "INSERT INTO var_audit (userId, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId, action, entityType ?? null, entityId ?? null, details ?? null, new Date().toISOString());
  } catch {
    // Audit is non-critical — never block the main operation
  }
}
