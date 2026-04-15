import React, { memo, useState, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Paper from "@mui/material/Paper";
import HistoryIcon from "@mui/icons-material/History";
import UndoIcon from "@mui/icons-material/Undo";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CloseIcon from "@mui/icons-material/Close";
import { easing } from "../../../../styles/animations";

const TYPE_ICONS = {
  create: AddIcon,
  edit: EditIcon,
  delete: DeleteIcon,
  drag: DragIndicatorIcon,
};

const TYPE_LABELS = {
  create: "Created",
  edit: "Modified",
  delete: "Deleted",
  drag: "Moved",
};

const TYPE_COLORS = {
  create: { color: "#16a34a", bgcolor: "#f0fdf4" },
  edit: { color: "primary.main", bgcolor: "#eff6ff" },
  delete: { color: "#ef4444", bgcolor: "#fef2f2" },
  drag: { color: "#d97706", bgcolor: "#fffbeb" },
};

const formatRelativeTime = (timestamp: string | number | Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
};

const HistoryEntry = memo(({ entry, onRevert, onReEdit }: any) => {
  const Icon = (TYPE_ICONS as Record<string, any>)[entry.type] || EditIcon;
  const colorStyle = (TYPE_COLORS as Record<string, any>)[entry.type] || {
    color: "text.secondary",
    bgcolor: "background.default",
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        transition: `background-color 0.3s ${easing.elegant}`,
        "&:hover": { bgcolor: "background.default" },
        "&:hover .history-actions": { opacity: 1 },
      }}
    >
      <Box sx={{ p: 0.75, borderRadius: 2, ...colorStyle, flexShrink: 0, mt: 0.25 }}>
        <Icon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>
            {(TYPE_LABELS as Record<string, any>)[entry.type]}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
            {formatRelativeTime(entry.timestamp)}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            mt: 0.25,
          }}
        >
          {entry.employeeName}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.jobName}
        </Typography>
        {entry.type === "edit" && entry.before && entry.after && (
          <Box sx={{ mt: 0.5, "& > *": { my: 0.25 } }}>
            {entry.before.utilization !== entry.after.utilization && (
              <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
                Utilization: {entry.before.utilization}% → {entry.after.utilization}%
              </Typography>
            )}
            {entry.before.startDate !== entry.after.startDate && (
              <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
                Start: {formatDate(entry.before.startDate)} → {formatDate(entry.after.startDate)}
              </Typography>
            )}
            {entry.before.endDate !== entry.after.endDate && (
              <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>
                End: {formatDate(entry.before.endDate)} → {formatDate(entry.after.endDate)}
              </Typography>
            )}
          </Box>
        )}
        {entry.type === "drag" && entry.before && entry.after && (
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", mt: 0.5 }}>
            {formatDate(entry.before.startDate)} → {formatDate(entry.after.startDate)}
          </Typography>
        )}
        <Box
          className="history-actions"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mt: 1,
            opacity: 0,
            transition: `opacity 0.3s ${easing.elegant}`,
          }}
        >
          {entry.type !== "delete" && (
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                onReEdit(entry);
              }}
              sx={{ fontSize: "0.75rem", color: "primary.main", textTransform: "none", minWidth: "auto", p: 0 }}
            >
              Edit
            </Button>
          )}
          <Button
            size="small"
            startIcon={<UndoIcon sx={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onRevert(entry);
            }}
            sx={{ fontSize: "0.75rem", color: "#d97706", textTransform: "none", minWidth: "auto", p: 0 }}
          >
            Revert
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

HistoryEntry.displayName = "HistoryEntry";

export const ChangeHistoryMenu = memo(
  ({ history = [], onRevert, onReEdit, onClearAll, compact = false, dropdownPosition = "bottom-right" }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const hasHistory = history.length > 0;

    return (
      <Box sx={{ position: "relative" }} ref={menuRef}>
        <Button
          onClick={() => hasHistory && setIsOpen(!isOpen)}
          startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
          sx={
            compact
              ? {
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textTransform: "none",
                  color: hasHistory ? "#fbbf24" : "#6b7280",
                  "&:hover": hasHistory ? { bgcolor: "text.primary" } : {},
                  cursor: hasHistory ? "pointer" : "default",
                }
              : {
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  fontSize: "0.875rem",
                  textTransform: "none",
                  ...(hasHistory
                    ? {
                        bgcolor: "#fffbeb",
                        color: "#b45309",
                        border: "1px solid #fde68a",
                        "&:hover": { bgcolor: "#fef3c7" },
                      }
                    : { bgcolor: "#f3f4f6", color: "text.disabled", border: "1px solid #e5e7eb", cursor: "default" }),
                }
          }
          title="Change history"
        >
          {compact && (
            <Typography
              component="span"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}
            >
              History
            </Typography>
          )}
          {hasHistory && (
            <Badge
              badgeContent={history.length}
              sx={{
                "& .MuiBadge-badge": compact
                  ? { bgcolor: "#f59e0b", color: "#fff", fontSize: "10px", fontWeight: 700, minWidth: 18, height: 18 }
                  : {
                      bgcolor: "#fde68a",
                      color: "#92400e",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      minWidth: 20,
                      height: 20,
                    },
              }}
            />
          )}
        </Button>

        {isOpen && hasHistory && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              width: 384,
              borderRadius: 3,
              border: "1px solid #e5e7eb",
              zIndex: 50,
              maxHeight: 480,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              ...(dropdownPosition === "right" ? { left: "100%", top: 0, ml: 1 } : { right: 0, mt: 1 }),
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 1.5,
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary" }}>
                  Change history
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.25 }}>
                  {history.length} change{history.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
              <IconButton onClick={() => setIsOpen(false)} size="small" aria-label="Close change history">
                <CloseIcon sx={{ fontSize: 16, color: "text.disabled" }} />
              </IconButton>
            </Box>

            {/* Scrollable list */}
            <Box sx={{ overflowY: "auto", flex: 1, p: 1 }}>
              {[...history].reverse().map((entry: any) => (
                <HistoryEntry
                  key={entry.id}
                  entry={entry}
                  onRevert={(e: any) => {
                    onRevert(e);
                    setIsOpen(false);
                  }}
                  onReEdit={(e: any) => {
                    onReEdit(e);
                    setIsOpen(false);
                  }}
                />
              ))}
            </Box>

            {/* Footer */}
            {onClearAll && (
              <Box sx={{ p: 1, borderTop: "1px solid #f3f4f6", bgcolor: "background.default", flexShrink: 0 }}>
                <Button
                  fullWidth
                  size="small"
                  onClick={() => {
                    onClearAll();
                    setIsOpen(false);
                  }}
                  sx={{
                    fontSize: "0.75rem",
                    color: "text.secondary",
                    textTransform: "none",
                    "&:hover": { color: "#ef4444" },
                  }}
                >
                  Clear history
                </Button>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    );
  }
);

ChangeHistoryMenu.displayName = "ChangeHistoryMenu";
