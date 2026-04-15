/**
 * CustomDashboard — User-configurable dashboard with a grid of widget slots.
 *
 * Like an iPhone home screen: drag cards from a palette onto the grid,
 * resize by dragging corners, rearrange by dragging. Layout persisted in localStorage.
 */

import React, { memo, useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Fade from "@mui/material/Fade";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useDashboardLayoutStore } from "../../stores/useDashboardLayoutStore";
import type { DashboardWidget } from "../../stores/useDashboardLayoutStore";
import { brand } from "../../config/brandConfig";
import { easing } from "../../styles/animations";
import { useWidgetCatalog } from "./widgets";

// ── Widget catalog (available cards) ──
export interface WidgetDef {
  key: string;
  label: string;
  group?: string;
  description: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  render: () => React.ReactNode;
}

const GRID_COLS = 4;
const ROW_HEIGHT = 300;
const GAP = 24;

const CustomDashboard = memo(() => {
  const theme = useTheme();
  const widgetCatalog = useWidgetCatalog();
  const isDark = theme.palette.mode === "dark";
  const widgets = useDashboardLayoutStore((s) => s.widgets);
  const addWidget = useDashboardLayoutStore((s) => s.addWidget);
  const removeWidget = useDashboardLayoutStore((s) => s.removeWidget);
  const moveWidget = useDashboardLayoutStore((s) => s.moveWidget);
  const resizeWidget = useDashboardLayoutStore((s) => s.resizeWidget);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<{ col: number; row: number } | null>(null);

  const catalogMap = useMemo(() => new Map(widgetCatalog.map((w) => [w.key, w])), [widgetCatalog]);

  // Compute the grid rows needed
  const maxRow = useMemo(() => {
    let max = 0;
    for (const w of widgets) max = Math.max(max, w.row + w.rowSpan);
    return Math.max(max + 1, 2); // at least 2 rows
  }, [widgets]);

  // Check if a cell is occupied
  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const w of widgets) {
      for (let c = w.col; c < w.col + w.colSpan; c++) {
        for (let r = w.row; r < w.row + w.rowSpan; r++) {
          set.add(`${c},${r}`);
        }
      }
    }
    return set;
  }, [widgets]);

  // Find first free slot
  const findFreeSlot = useCallback((): { col: number; row: number } => {
    for (let r = 0; r < maxRow + 2; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!occupiedCells.has(`${c},${r}`)) return { col: c, row: r };
      }
    }
    return { col: 0, row: maxRow };
  }, [occupiedCells, maxRow]);

  const handleAddWidget = useCallback(
    (def: WidgetDef) => {
      const slot = findFreeSlot();
      addWidget(def.key, slot.col, slot.row);
      setPaletteOpen(false);
    },
    [addWidget, findFreeSlot]
  );

  // Widget drag & drop between slots
  const handleWidgetDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    e.dataTransfer.setData("application/dashboard-widget", widgetId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleSlotDragOver = useCallback((e: React.DragEvent, col: number, row: number) => {
    if (
      e.dataTransfer.types.includes("application/dashboard-widget") ||
      e.dataTransfer.types.includes("application/dashboard-catalog")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverSlot({ col, row });
    }
  }, []);

  const handleSlotDrop = useCallback(
    (e: React.DragEvent, col: number, row: number) => {
      e.preventDefault();
      setDragOverSlot(null);
      const widgetId = e.dataTransfer.getData("application/dashboard-widget");
      if (widgetId) {
        moveWidget(widgetId, col, row);
        return;
      }
      const catalogKey = e.dataTransfer.getData("application/dashboard-catalog");
      if (catalogKey) {
        addWidget(catalogKey, col, row);
      }
    },
    [moveWidget, addWidget]
  );

  // Resize via drag on corner
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, widget: DashboardWidget) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const origColSpan = widget.colSpan;
      const origRowSpan = widget.rowSpan;
      const cellW = (el.closest("[data-grid-container]") as HTMLElement)?.clientWidth / GRID_COLS || 300;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newColSpan = Math.max(1, Math.min(GRID_COLS - widget.col, origColSpan + Math.round(dx / cellW)));
        const newRowSpan = Math.max(1, origRowSpan + Math.round(dy / ROW_HEIGHT));
        resizeWidget(widget.id, newColSpan, newRowSpan);
      };
      const onUp = () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [resizeWidget]
  );

  // Widgets already placed (for catalog filtering)
  const placedKeys = useMemo(() => new Set(widgets.map((w) => w.widgetKey)), [widgets]);

  return (
    <Fade in timeout={400}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            My Dashboard
          </Typography>
          <Tooltip title="Add widget">
            <IconButton
              onClick={() => setPaletteOpen(!paletteOpen)}
              sx={{ bgcolor: brand.primary, color: "#fff", "&:hover": { bgcolor: brand.primaryDark } }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Widget palette */}
        {paletteOpen &&
          (() => {
            // Group widgets by tab
            const groups = new Map<string, WidgetDef[]>();
            for (const def of widgetCatalog) {
              const g = def.group || "Autre";
              if (!groups.has(g)) groups.set(g, []);
              groups.get(g)!.push(def);
            }
            return (
              <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: alpha(brand.primary, 0.04) }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                  Widgets disponibles
                </Typography>
                {[...groups.entries()].map(([groupName, defs]) => (
                  <Box key={groupName} sx={{ mb: 1.5 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.72rem", fontWeight: 600, color: "text.secondary", mb: 0.5, display: "block" }}
                    >
                      {groupName}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {defs.map((def) => {
                        const placed = placedKeys.has(def.key);
                        return (
                          <Chip
                            key={def.key}
                            label={def.label}
                            draggable={!placed}
                            onClick={() => !placed && handleAddWidget(def)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/dashboard-catalog", def.key);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            sx={{
                              cursor: placed ? "default" : "grab",
                              opacity: placed ? 0.4 : 1,
                              fontWeight: 600,
                              "&:active": { cursor: "grabbing" },
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Paper>
            );
          })()}

        {/* Grid */}
        <Box
          data-grid-container
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridAutoRows: "auto",
            gap: `${GAP}px`,
          }}
        >
          {/* Placed widgets */}
          {widgets.map((widget) => {
            const def = catalogMap.get(widget.widgetKey);
            if (!def) return null;

            return (
              <Paper
                key={widget.id}
                elevation={0}
                draggable
                onDragStart={(e) => handleWidgetDragStart(e, widget.id)}
                sx={{
                  gridColumn: `${widget.col + 1} / span ${widget.colSpan}`,
                  gridRow: `${widget.row + 1} / span ${widget.rowSpan}`,
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  transition: `box-shadow 0.3s ${easing.elegant}`,
                  "&:hover": { boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
                  "&:hover .widget-controls": { opacity: 1 },
                }}
              >
                {/* Widget controls (visible on hover) */}
                <Box
                  className="widget-controls"
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 2,
                    display: "flex",
                    gap: 0.25,
                    opacity: 0,
                    transition: `opacity 0.2s ${easing.elegant}`,
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{ bgcolor: alpha("#000", 0.05), "&:hover": { bgcolor: alpha("#000", 0.1) } }}
                  >
                    <DragIndicatorIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => removeWidget(widget.id)}
                    sx={{ bgcolor: alpha("#000", 0.05), "&:hover": { bgcolor: alpha("#ef4444", 0.1) } }}
                  >
                    <CloseIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                  </IconButton>
                </Box>

                {/* Widget content */}
                <Box sx={{ flex: 1, overflow: "hidden" }}>{def.render()}</Box>

                {/* Resize handle */}
                <Box
                  onPointerDown={(e) => handleResizePointerDown(e, widget)}
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 16,
                    height: 16,
                    cursor: "nwse-resize",
                    zIndex: 2,
                    opacity: 0,
                    transition: `opacity 0.2s ${easing.elegant}`,
                    ".MuiPaper-root:hover &": { opacity: 0.4 },
                    "&:hover": { opacity: 0.8 },
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M14 2L2 14" stroke={theme.palette.text.secondary} strokeWidth="1.2" />
                    <path d="M14 7L7 14" stroke={theme.palette.text.secondary} strokeWidth="1.2" />
                    <path d="M14 12L12 14" stroke={theme.palette.text.secondary} strokeWidth="1.2" />
                  </svg>
                </Box>
              </Paper>
            );
          })}

          {/* Empty slots (drop targets) */}
          {Array.from({ length: GRID_COLS * maxRow }, (_, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            if (occupiedCells.has(`${col},${row}`)) return null;
            const isOver = dragOverSlot?.col === col && dragOverSlot?.row === row;

            return (
              <Box
                key={`slot-${col}-${row}`}
                onDragOver={(e) => handleSlotDragOver(e, col, row)}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleSlotDrop(e, col, row)}
                sx={{
                  gridColumn: `${col + 1}`,
                  gridRow: `${row + 1}`,
                  minHeight: 120,
                  borderRadius: 3,
                  border: `2px dashed ${isOver ? alpha(brand.primary, 0.4) : alpha(theme.palette.text.disabled, 0.12)}`,
                  bgcolor: isOver ? alpha(brand.primary, 0.04) : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: `all 0.2s ${easing.elegant}`,
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: alpha(brand.primary, 0.25),
                    bgcolor: alpha(brand.primary, 0.02),
                  },
                }}
                onClick={() => setPaletteOpen(true)}
              >
                <AddIcon sx={{ fontSize: 24, color: alpha(theme.palette.text.disabled, 0.25) }} />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Fade>
  );
});
CustomDashboard.displayName = "CustomDashboard";

export default CustomDashboard;
