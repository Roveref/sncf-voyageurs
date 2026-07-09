/**
 * NotificationBell — Badge icon + dropdown panel showing recent notifications.
 * Fetches from /api/notifications and listens to SSE "notification" events.
 */

import React, { memo, useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "../../stores/useAppStore";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { API_BASE, apiFetch } from "../../services/api";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useUIStore } from "../../stores/useUIStore";

interface Notification {
  id: number | string;
  type: string;
  title: string;
  message: string | null;
  opportunityId: string | null;
  isRead: number;
  createdAt: string;
  _isAction?: boolean;
  _actionStatus?: string;
}

const NotificationBell = memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [rawUnreadCount, setRawUnreadCount] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  // Region/country filter from landing page
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  // Notification-scoped IDs (sidebar filters only, no display toggles)
  const filteredOppIds = useAppStore((s) => s.notifFilteredOppIds);

  // Build query string for region/country
  const regionQs = useMemo(() => {
    if (!hydrationFilter) return "";
    const params = new URLSearchParams();
    if (hydrationFilter.country) params.set("country", hydrationFilter.country);
    else if (hydrationFilter.region) params.set("region", hydrationFilter.region);
    return params.toString() ? `?${params.toString()}` : "";
  }, [hydrationFilter]);

  const fetchNotifications = useCallback(async () => {
    try {
      const [nRes, cRes] = await Promise.all([
        apiFetch(`${API_BASE}/notifications${regionQs}`),
        apiFetch(`${API_BASE}/notifications/count${regionQs}`),
      ]);
      if (nRes.ok) {
        const data = await nRes.json();
        setAllNotifications(data.notifications || []);
      }
      if (cRes.ok) {
        const data = await cRes.json();
        setRawUnreadCount(data.count || 0);
      }
    } catch {
      /* silent */
    }
  }, [regionQs]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Re-fetch when SSE notification signal fires
  const sseNotificationVersion = useAppStore((s) => s.sseNotificationVersion);
  useEffect(() => {
    if (sseNotificationVersion > 0) fetchNotifications();
  }, [sseNotificationVersion, fetchNotifications]);

  // Apply sidebar filters + dismissal filter
  const notifications = useMemo(() => {
    let filtered = allNotifications;
    // Hide notifications that existed before "mark all read"
    if (dismissedAt) filtered = filtered.filter((n) => n.createdAt > dismissedAt);
    if (filteredOppIds.size > 0)
      filtered = filtered.filter((n) => !n.opportunityId || filteredOppIds.has(n.opportunityId));
    return filtered;
  }, [allNotifications, filteredOppIds, dismissedAt]);

  const unreadCount = useMemo(() => {
    if (filteredOppIds.size === 0) return rawUnreadCount;
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications, rawUnreadCount, filteredOppIds]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => setAnchorEl(null);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch(`${API_BASE}/notifications/read-all`, { method: "POST" });
      setDismissedAt(new Date().toISOString());
      setRawUnreadCount(0);
      handleClose();
    } catch {
      /* silent */
    }
  };

  const handleDismissOne = async (n: Notification) => {
    // Remove from local list immediately
    setAllNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setRawUnreadCount((prev) => Math.max(0, prev - 1));
    // Mark as read on server (only for real notifications, not virtual actions)
    if (!n._isAction) {
      try {
        await apiFetch(`${API_BASE}/notifications/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [n.id] }),
        });
      } catch {
        /* silent */
      }
    }
  };

  const handleActionDone = (n: Notification) => {
    if (!n.opportunityId || !n._isAction) return;
    const actionId = String(n.id).replace("action_", "");
    const store = useUserDataStore.getState();
    const actions = store.opportunityActions[n.opportunityId] || [];
    store.setOpportunityActions(
      n.opportunityId,
      actions.map((a) => (a.id === actionId ? { ...a, status: "done" } : a))
    );
    // Remove from local list
    setAllNotifications((prev) => prev.filter((x: Notification) => x.id !== n.id));
    setRawUnreadCount((prev) => Math.max(0, prev - (n.isRead ? 0 : 1)));
  };

  const handleConsult = (n: Notification) => {
    if (!n.opportunityId) return;
    handleClose();
    navigate("/pipeline");
    useUIStore.getState().navigateToOpportunity(n.opportunityId);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH}h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  const typeColors: Record<string, string> = {
    open_action: "#f59e0b",
    crm_update: "#3b82f6",
    staffing_need: "#8b5cf6",
    action: "#f59e0b",
    opportunity: "#10b981",
    status_change: "#8b5cf6",
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white" } }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480, borderRadius: 2 } } }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllRead} sx={{ textTransform: "none", fontSize: "0.7rem" }}>
              Tout marquer comme lu
            </Button>
          )}
        </Box>

        {notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.disabled">
              Aucune notification
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
            {notifications.map((n) => (
              <Box
                key={n.id}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  bgcolor: n.isRead ? "transparent" : alpha(theme.palette.primary.main, 0.04),
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: typeColors[n.type] || "#6b7280",
                    mt: 0.75,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    fontWeight={n.isRead ? 400 : 700}
                    sx={{ fontSize: "0.75rem", display: "block" }}
                  >
                    {n.title}
                  </Typography>
                  {n.message && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                      {n.message}
                    </Typography>
                  )}
                </Box>
                {n._isAction && hoveredId === n.id ? (
                  <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, alignItems: "center" }}>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionDone(n);
                      }}
                      sx={{
                        minWidth: 0,
                        px: 0.75,
                        py: 0.25,
                        fontSize: "0.65rem",
                        textTransform: "none",
                        color: "#16a34a",
                        "&:hover": { bgcolor: alpha("#16a34a", 0.1) },
                      }}
                      startIcon={<CheckCircleOutlineIcon sx={{ fontSize: "0.85rem !important" }} />}
                    >
                      Done
                    </Button>
                    {n.opportunityId && (
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConsult(n);
                        }}
                        sx={{
                          minWidth: 0,
                          px: 0.75,
                          py: 0.25,
                          fontSize: "0.65rem",
                          textTransform: "none",
                          color: "#3b82f6",
                          "&:hover": { bgcolor: alpha("#3b82f6", 0.1) },
                        }}
                        startIcon={<OpenInNewIcon sx={{ fontSize: "0.85rem !important" }} />}
                      >
                        Consult
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ fontSize: "0.6rem", whiteSpace: "nowrap" }}
                    >
                      {formatTime(n.createdAt)}
                    </Typography>
                    {hoveredId === n.id && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissOne(n);
                        }}
                        sx={{
                          width: 20,
                          height: 20,
                          color: "text.disabled",
                          "&:hover": { color: "text.secondary", bgcolor: alpha(theme.palette.text.primary, 0.08) },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Popover>
    </>
  );
});

NotificationBell.displayName = "NotificationBell";
export default NotificationBell;
