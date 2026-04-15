/**
 * Unique tab identifier — persists for the lifetime of this browser tab.
 * Used to filter out self-echoed SSE events (user-data-saved).
 */
export const TAB_ID = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
