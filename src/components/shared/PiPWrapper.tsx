/**
 * PiPWrapper — Reusable floating Picture-in-Picture container.
 *
 * Provides drag-to-move, resize, edge-snapping (left/right/top→fullscreen),
 * double-click to fullscreen toggle, and localStorage persistence.
 *
 * Usage:
 *   <PiPWrapper open={open} onClose={onClose} storageKey="my-panel" title="My Panel">
 *     {children}
 *   </PiPWrapper>
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Portal from "@mui/material/Portal";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { brand } from "../../config/brandConfig";
import { easing } from "../../styles/animations";
import { safeJsonParse } from "../../utils/safeJson";
import { useSnapLayout } from "./snapLayout";

// ── Focus-to-front: global z-index counter ──
// Each PiP/Dialog gets an incrementing z-index when clicked, bringing it to front.
let _globalZCounter = 10100;
export function bringToFront(): number {
  return ++_globalZCounter;
}

// ── Constants ──
const SNAP_EDGE_PX = 20;
const APP_BAR_H = 64;
const DRAG_DEADZONE = 5;
const ELEGANT = easing.elegant;

type SnapState = "none" | "left" | "right" | "full" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

// ── Props ──
export interface PiPWrapperProps {
  open: boolean;
  onClose: () => void;
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Title shown in the drag header */
  title: string;
  /** Optional icon next to the title */
  icon?: ReactNode;
  /** Header extra content (KPIs, toggles, etc.) rendered below the title row */
  headerContent?: ReactNode;
  /** Default width */
  defaultWidth?: number;
  /** Default height */
  defaultHeight?: number;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** If true, skip the built-in header (title, divider) — children provide their own */
  headless?: boolean;
  children: ReactNode;
}

// ── Helpers ──
const readPos = (key: string, defaultW: number): { x: number; y: number } => {
  const raw = localStorage.getItem(`${key}_pos`);
  if (raw) {
    const p = safeJsonParse<any>(raw, null);
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  }
  return { x: Math.max(0, window.innerWidth - defaultW - 24), y: 80 };
};

const readSize = (key: string, dw: number, dh: number): { w: number; h: number } => {
  const raw = localStorage.getItem(`${key}_size`);
  if (raw) {
    const s = safeJsonParse<any>(raw, null);
    if (s && typeof s.w === "number" && typeof s.h === "number") return s;
  }
  return { w: dw, h: dh };
};

const detectSnapZone = (clientX: number, clientY: number): SnapState => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const atLeft = clientX <= SNAP_EDGE_PX;
  const atRight = clientX >= vw - SNAP_EDGE_PX;
  const atTop = clientY <= SNAP_EDGE_PX + APP_BAR_H;
  const atBottom = clientY >= vh - SNAP_EDGE_PX;

  // Corners → quarter snap
  if (atLeft && atTop) return "top-left";
  if (atRight && atTop) return "top-right";
  if (atLeft && atBottom) return "bottom-left";
  if (atRight && atBottom) return "bottom-right";
  // Edges → half / full
  if (atTop) return "full";
  if (atLeft) return "left";
  if (atRight) return "right";
  return "none";
};

const PiPWrapper = memo(
  ({
    open,
    onClose,
    storageKey,
    title,
    icon,
    headerContent,
    defaultWidth = 720,
    defaultHeight = 680,
    minWidth = 520,
    minHeight = 400,
    headless = false,
    children,
  }: PiPWrapperProps) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const borderDivider = isDark ? alpha("#fff", 0.06) : alpha("#000", 0.06);
    const [myZ, setMyZ] = useState(() => bringToFront());
    const handleFocus = useCallback(() => setMyZ(bringToFront()), []);

    // ── Global snap layout ratios ──
    const splitX = useSnapLayout((s) => s.splitX);
    const splitY = useSnapLayout((s) => s.splitY);
    const setSplitX = useSnapLayout((s) => s.setSplitX);
    const setSplitY = useSnapLayout((s) => s.setSplitY);

    // ── Position, size & snap ──
    const [pos, setPos] = useState(() => readPos(storageKey, defaultWidth));
    const [size, setSize] = useState(() => readSize(storageKey, defaultWidth, defaultHeight));
    const [snap, setSnap] = useState<SnapState>("none");
    const [snapPreview, setSnapPreview] = useState<SnapState>("none");
    const floatingRef = useRef({
      pos: readPos(storageKey, defaultWidth),
      size: readSize(storageKey, defaultWidth, defaultHeight),
    });
    const moveRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
    const pendingRef = useRef<{
      el: HTMLElement;
      pointerId: number;
      startX: number;
      startY: number;
      captured: boolean;
    } | null>(null);

    // Persist
    useEffect(() => {
      if (snap === "none") localStorage.setItem(`${storageKey}_pos`, JSON.stringify(pos));
    }, [pos, snap, storageKey]);
    useEffect(() => {
      if (snap === "none") localStorage.setItem(`${storageKey}_size`, JSON.stringify(size));
    }, [size, snap, storageKey]);

    // Clamp on window resize
    useEffect(() => {
      const onResize = () => {
        if (snap !== "none") return;
        setPos((p) => ({
          x: Math.max(0, Math.min(window.innerWidth - 100, p.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, p.y)),
        }));
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [snap]);

    // Effective position/size (uses global splitX/splitY for snapped positions)
    const effective = useMemo(() => {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const availH = vh - APP_BAR_H;
      const lw = Math.round(vw * splitX);
      const rw = vw - lw;
      const th = Math.round(availH * splitY);
      const bh = availH - th;
      switch (snap) {
        case "left":
          return { x: 0, y: APP_BAR_H, w: lw, h: availH };
        case "right":
          return { x: lw, y: APP_BAR_H, w: rw, h: availH };
        case "full":
          return { x: 0, y: APP_BAR_H, w: vw, h: availH };
        case "top-left":
          return { x: 0, y: APP_BAR_H, w: lw, h: th };
        case "top-right":
          return { x: lw, y: APP_BAR_H, w: rw, h: th };
        case "bottom-left":
          return { x: 0, y: APP_BAR_H + th, w: lw, h: bh };
        case "bottom-right":
          return { x: lw, y: APP_BAR_H + th, w: rw, h: bh };
        default:
          return { x: pos.x, y: pos.y, w: size.w, h: size.h };
      }
    }, [snap, pos, size, splitX, splitY]);

    // ── Snap ──
    const applySnap = useCallback(
      (newSnap: SnapState) => {
        if (newSnap === snap) return;
        if (snap === "none") floatingRef.current = { pos: { ...pos }, size: { ...size } };
        if (newSnap === "none") {
          setPos(floatingRef.current.pos);
          setSize(floatingRef.current.size);
        }
        setSnap(newSnap);
      },
      [snap, pos, size]
    );

    // ── Double-click → re-attach (close PiP) ──
    const handleDoubleClick = useCallback(() => {
      onClose();
    }, [onClose]);

    // ── Drag to move (with deadzone) ──
    const handleMoveDown = useCallback((e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, [data-no-drag]")) return;
      // Ignore if an HTML5 drag is in progress (e.g. employee drag & drop)
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      e.preventDefault();
      pendingRef.current = {
        el: e.currentTarget as HTMLElement,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        captured: false,
      };
    }, []);

    const handleMoveMove = useCallback(
      (e: React.PointerEvent) => {
        if (pendingRef.current && !moveRef.current) {
          const dx = Math.abs(e.clientX - pendingRef.current.startX);
          const dy = Math.abs(e.clientY - pendingRef.current.startY);
          if (dx < DRAG_DEADZONE && dy < DRAG_DEADZONE) return;
          if (!pendingRef.current.captured) {
            pendingRef.current.el.setPointerCapture(pendingRef.current.pointerId);
            pendingRef.current.captured = true;
          }
          if (snap !== "none") {
            const fw = floatingRef.current.size.w;
            const newX = Math.max(0, e.clientX - fw / 2);
            const newY = Math.max(0, e.clientY - 20);
            setPos({ x: newX, y: newY });
            setSize(floatingRef.current.size);
            setSnap("none");
            moveRef.current = { startX: e.clientX, startY: e.clientY, origX: newX, origY: newY };
          } else {
            moveRef.current = {
              startX: pendingRef.current.startX,
              startY: pendingRef.current.startY,
              origX: pos.x,
              origY: pos.y,
            };
          }
          pendingRef.current = null;
        }
        if (!moveRef.current) return;
        setPos({
          x: Math.max(
            0,
            Math.min(window.innerWidth - 100, moveRef.current.origX + (e.clientX - moveRef.current.startX))
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - 100, moveRef.current.origY + (e.clientY - moveRef.current.startY))
          ),
        });
        setSnapPreview(detectSnapZone(e.clientX, e.clientY));
      },
      [snap, pos]
    );

    const handleMoveUp = useCallback(
      (e: React.PointerEvent) => {
        // Only process if this is the pointer that started the drag
        if (pendingRef.current && pendingRef.current.pointerId !== e.pointerId) return;
        pendingRef.current = null;
        if (!moveRef.current) return;
        moveRef.current = null;
        const zone = detectSnapZone(e.clientX, e.clientY);
        if (zone !== "none") applySnap(zone);
        setSnapPreview("none");
      },
      [applySnap]
    );

    // ── Resize from any edge/corner (pointer capture based) ──
    const handleEdgeResizeDown = useCallback(
      (edge: string) => (e: React.PointerEvent) => {
        if (snap !== "none") return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const startX = e.clientX,
          startY = e.clientY;
        const origW = size.w,
          origH = size.h,
          origX = pos.x,
          origY = pos.y;
        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let newW = origW,
            newH = origH,
            newX = origX,
            newY = origY;
          if (edge.includes("right")) newW = Math.max(minWidth, Math.min(window.innerWidth - 40, origW + dx));
          if (edge.includes("bottom")) newH = Math.max(minHeight, Math.min(window.innerHeight - 80, origH + dy));
          if (edge.includes("left")) {
            newW = Math.max(minWidth, origW - dx);
            newX = origX + origW - newW;
          }
          if (edge.includes("top")) {
            newH = Math.max(minHeight, origH - dy);
            newY = origY + origH - newH;
          }
          setSize({ w: newW, h: newH });
          setPos({ x: newX, y: newY });
        };
        const onUp = () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
      },
      [size, pos, snap, minWidth, minHeight]
    );

    if (!open) return null;

    const isSnapped = snap !== "none";

    return (
      <Portal>
        {/* Snap preview */}
        {snapPreview !== "none" &&
          (() => {
            const m = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const availH = vh - APP_BAR_H;
            const lw = Math.round(vw * splitX);
            const rw = vw - lw;
            const th = Math.round(availH * splitY);
            const bh = availH - th;
            const previewMap: Record<string, { top: number; left: number; width: number; height: number }> = {
              full: { top: APP_BAR_H + m, left: m, width: vw - m * 2, height: availH - m * 2 },
              left: { top: APP_BAR_H + m, left: m, width: lw - m * 1.5, height: availH - m * 2 },
              right: { top: APP_BAR_H + m, left: lw + m * 0.5, width: rw - m * 1.5, height: availH - m * 2 },
              "top-left": { top: APP_BAR_H + m, left: m, width: lw - m * 1.5, height: th - m * 1.5 },
              "top-right": { top: APP_BAR_H + m, left: lw + m * 0.5, width: rw - m * 1.5, height: th - m * 1.5 },
              "bottom-left": { top: APP_BAR_H + th + m * 0.5, left: m, width: lw - m * 1.5, height: bh - m * 1.5 },
              "bottom-right": {
                top: APP_BAR_H + th + m * 0.5,
                left: lw + m * 0.5,
                width: rw - m * 1.5,
                height: bh - m * 1.5,
              },
            };
            const r = previewMap[snapPreview];
            return r ? (
              <Box
                sx={{
                  position: "fixed",
                  zIndex: myZ - 1,
                  pointerEvents: "none",
                  top: r.top,
                  left: r.left,
                  width: r.width,
                  height: r.height,
                  bgcolor: alpha(brand.primary, 0.06),
                  border: `2px dashed ${alpha(brand.primary, 0.2)}`,
                  borderRadius: 3,
                  transition: `all 0.2s ${ELEGANT}`,
                }}
              />
            ) : null;
          })()}

        <Paper
          elevation={0}
          onPointerDown={handleFocus}
          sx={{
            position: "fixed",
            top: effective.y,
            left: effective.x,
            width: effective.w,
            height: effective.h,
            zIndex: myZ,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: isSnapped ? 0 : 3,
            bgcolor: isDark ? brand.darkPaper : brand.white,
            boxShadow: isSnapped
              ? `inset 0 0 0 1px ${borderDivider}`
              : `0 8px 32px ${alpha("#000", 0.08)}, 0 2px 8px ${alpha("#000", 0.04)}`,
            transition:
              isSnapped || snapPreview !== "none"
                ? `top 0.3s ${ELEGANT}, left 0.3s ${ELEGANT}, width 0.3s ${ELEGANT}, height 0.3s ${ELEGANT}, border-radius 0.2s ${ELEGANT}, box-shadow 0.3s ${ELEGANT}`
                : `box-shadow 0.3s ${ELEGANT}`,
            "&:hover": isSnapped
              ? {}
              : { boxShadow: `0 12px 40px ${alpha("#000", 0.12)}, 0 4px 12px ${alpha("#000", 0.06)}` },
          }}
        >
          {/* ── Drag handle (invisible, covers top of card) ── */}
          <Box
            onPointerDown={handleMoveDown}
            onPointerMove={handleMoveMove}
            onPointerUp={handleMoveUp}
            onDoubleClick={handleDoubleClick}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              zIndex: 3,
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
            }}
          />

          {/* ── Close button (only in normal mode; headless cards render their own via usePiPCloseButton) ── */}
          {!headless && (
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 4,
                color: "text.disabled",
                "&:hover": { color: "text.secondary", bgcolor: alpha(theme.palette.text.primary, 0.06) },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}

          {/* ── Content ── */}
          {headless ? (
            <Box
              sx={{
                overflow: "auto",
                flex: 1,
                bgcolor: isDark ? brand.darkPaper : brand.white,
                "& > *": { height: "100%" },
              }}
            >
              {children}
            </Box>
          ) : (
            <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mr: 2, flexShrink: 0 }}>
                  {title}
                </Typography>
                {headerContent && (
                  <Box sx={{ flex: 1, minWidth: 0, mr: 4 }} data-no-drag>
                    {headerContent}
                  </Box>
                )}
              </Box>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
                {children}
              </Box>
            </Box>
          )}

          {/* ── Resize handles — all edges and corners (floating mode) ── */}
          {!isSnapped && (
            <>
              {/* Edges */}
              <Box
                onPointerDown={handleEdgeResizeDown("top")}
                sx={{ position: "absolute", top: 0, left: 8, right: 8, height: 4, cursor: "ns-resize", zIndex: 2 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("bottom")}
                sx={{ position: "absolute", bottom: 0, left: 8, right: 8, height: 4, cursor: "ns-resize", zIndex: 2 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("left")}
                sx={{ position: "absolute", top: 8, bottom: 8, left: 0, width: 4, cursor: "ew-resize", zIndex: 2 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("right")}
                sx={{ position: "absolute", top: 8, bottom: 8, right: 0, width: 4, cursor: "ew-resize", zIndex: 2 }}
              />
              {/* Corners */}
              <Box
                onPointerDown={handleEdgeResizeDown("top-left")}
                sx={{ position: "absolute", top: 0, left: 0, width: 8, height: 8, cursor: "nwse-resize", zIndex: 3 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("top-right")}
                sx={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, cursor: "nesw-resize", zIndex: 3 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("bottom-left")}
                sx={{ position: "absolute", bottom: 0, left: 0, width: 8, height: 8, cursor: "nesw-resize", zIndex: 3 }}
              />
              <Box
                onPointerDown={handleEdgeResizeDown("bottom-right")}
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  cursor: "nwse-resize",
                  zIndex: 3,
                }}
              />
            </>
          )}

          {/* ── Snap edge dividers (snapped mode) — drag to adjust split ratios ── */}
          {isSnapped && snap !== "full" && (
            <>
              {(snap === "left" || snap === "top-left" || snap === "bottom-left") && (
                <SnapDivider axis="vertical" position="right" setter={setSplitX} total={window.innerWidth} offset={0} />
              )}
              {(snap === "right" || snap === "top-right" || snap === "bottom-right") && (
                <SnapDivider axis="vertical" position="left" setter={setSplitX} total={window.innerWidth} offset={0} />
              )}
              {(snap === "top-left" || snap === "top-right") && (
                <SnapDivider
                  axis="horizontal"
                  position="bottom"
                  setter={setSplitY}
                  total={window.innerHeight - APP_BAR_H}
                  offset={APP_BAR_H}
                />
              )}
              {(snap === "bottom-left" || snap === "bottom-right") && (
                <SnapDivider
                  axis="horizontal"
                  position="top"
                  setter={setSplitY}
                  total={window.innerHeight - APP_BAR_H}
                  offset={APP_BAR_H}
                />
              )}
            </>
          )}
        </Paper>
      </Portal>
    );
  }
);
PiPWrapper.displayName = "PiPWrapper";

// ── SnapDivider — draggable edge for adjusting split ratios between snapped PiPs ──
// Uses absolute cursor position → ratio, no delta accumulation (avoids stale closure issues)
const SnapDivider = memo(
  ({
    axis,
    position,
    setter,
    total,
    offset,
  }: {
    axis: "vertical" | "horizontal";
    position: "left" | "right" | "top" | "bottom";
    setter: (ratio: number) => void;
    total: number; // total size in px (vw for X, availH for Y)
    offset: number; // px offset from viewport edge (0 for X, APP_BAR_H for Y)
  }) => {
    const isV = axis === "vertical";
    const handleDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => {
          const px = isV ? ev.clientX : ev.clientY - offset;
          setter(px / total);
        };
        const onUp = () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
      },
      [isV, setter, total, offset]
    );

    const posStyle: Record<string, any> = {
      position: "absolute",
      zIndex: 2,
      ...(isV
        ? { top: 0, bottom: 0, width: 6, cursor: "col-resize", [position]: -3 }
        : { left: 0, right: 0, height: 6, cursor: "row-resize", [position]: -3 }),
    };

    return (
      <Box
        onPointerDown={handleDown}
        sx={{
          ...posStyle,
          bgcolor: "transparent",
          "&:hover": { bgcolor: `rgba(255, 61, 71, 0.15)` },
          "&:active": { bgcolor: `rgba(255, 61, 71, 0.25)` },
          transition: "background-color 0.15s ease",
        }}
      />
    );
  }
);
SnapDivider.displayName = "SnapDivider";

export default PiPWrapper;
