/**
 * usePiPDragResize — Position & resize drag logic for PiP panels.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { safeJsonParse } from "../../../../utils/safeJson";

const LS_POS = "pip_needs_panel_pos";
const LS_SIZE = "pip_needs_panel_size";
const DEFAULT_W = 600;
const DEFAULT_H = 560;
const MIN_W = 500;
const MIN_H = 300;
const MAX_W = 960;

const readPos = (idx: number): { x: number; y: number } => {
  const raw = localStorage.getItem(`${LS_POS}_${idx}`);
  if (raw) {
    const p = safeJsonParse<any>(raw, null);
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  }
  const offsetX = idx * 30;
  const offsetY = idx * 30;
  return { x: Math.max(0, window.innerWidth - DEFAULT_W - 24 - offsetX), y: 80 + offsetY };
};

const readSize = (idx: number): { w: number; h: number } => {
  const raw = localStorage.getItem(`${LS_SIZE}_${idx}`);
  if (raw) {
    const s = safeJsonParse<any>(raw, null);
    if (s && typeof s.w === "number" && typeof s.h === "number") return s;
  }
  return { w: DEFAULT_W, h: DEFAULT_H };
};

export function usePiPDragResize(instanceIndex: number) {
  const [pos, setPos] = useState(() => readPos(instanceIndex));
  const [size, setSize] = useState(() => readSize(instanceIndex));
  const moveRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const posKey = `${LS_POS}_${instanceIndex}`;
  const sizeKey = `${LS_SIZE}_${instanceIndex}`;

  const handleMoveDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, [data-no-drag]")) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      moveRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    },
    [pos]
  );

  const handleMoveMove = useCallback((e: React.PointerEvent) => {
    if (!moveRef.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 100, moveRef.current.origX + (e.clientX - moveRef.current.startX))),
      y: Math.max(0, Math.min(window.innerHeight - 100, moveRef.current.origY + (e.clientY - moveRef.current.startY))),
    });
  }, []);

  const handleMoveUp = useCallback(() => {
    if (moveRef.current) {
      moveRef.current = null;
      setPos((p) => {
        localStorage.setItem(posKey, JSON.stringify(p));
        return p;
      });
    }
  }, [posKey]);

  const handleResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    },
    [size]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    setSize({
      w: Math.max(MIN_W, Math.min(MAX_W, resizeRef.current.origW + (e.clientX - resizeRef.current.startX))),
      h: Math.max(
        MIN_H,
        Math.min(window.innerHeight - 80, resizeRef.current.origH + (e.clientY - resizeRef.current.startY))
      ),
    });
  }, []);

  const handleResizeUp = useCallback(() => {
    if (resizeRef.current) {
      resizeRef.current = null;
      setSize((s) => {
        localStorage.setItem(sizeKey, JSON.stringify(s));
        return s;
      });
    }
  }, [sizeKey]);

  useEffect(() => {
    const handler = () => {
      setPos((p) => ({
        x: Math.max(0, Math.min(window.innerWidth - 100, p.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, p.y)),
      }));
      setSize((s) => ({ w: Math.min(s.w, MAX_W), h: Math.min(s.h, window.innerHeight - 80) }));
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    pos,
    size,
    handleMoveDown,
    handleMoveMove,
    handleMoveUp,
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  };
}
