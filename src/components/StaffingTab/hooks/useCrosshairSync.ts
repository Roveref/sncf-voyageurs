/**
 * Module-level crosshair store for bidirectional hover sync
 * between TU Trend chart and Timeline heatmaps.
 *
 * Uses useSyncExternalStore so only subscribing components re-render.
 */
import { useSyncExternalStore } from "react";

export type CrosshairRange = {
  startMs: number;
  endMs: number;
  source: "trend" | "timeline";
  /** Direct column fractions for pixel-perfect alignment (set by HeatmapStrip) */
  fracStart?: number;
  fracWidth?: number;
} | null;

let _range: CrosshairRange = null;
const _listeners = new Set<() => void>();

export const setCrosshairRange = (range: CrosshairRange) => {
  if (
    range === _range ||
    (range &&
      _range &&
      range.startMs === _range.startMs &&
      range.endMs === _range.endMs &&
      range.source === _range.source)
  )
    return;
  _range = range;
  _listeners.forEach((fn) => fn());
};

export const getCrosshairRange = (): CrosshairRange => _range;

export const useCrosshairRange = (): CrosshairRange => {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _range
  );
};
