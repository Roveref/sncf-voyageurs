/**
 * snapLayout — Global split ratios for snapped PiP windows.
 *
 * Two ratios control all snapped positions:
 * - splitX (0-1): vertical divider position (left/right boundary)
 * - splitY (0-1): horizontal divider position (top/bottom boundary)
 *
 * When any snapped PiP resizes its shared edge, it updates the global ratio,
 * and all other snapped PiPs adjust automatically.
 */

import { create } from "zustand";

interface SnapLayoutState {
  splitX: number; // 0-1, default 0.5 — vertical split (left|right)
  splitY: number; // 0-1, default 0.5 — horizontal split (top|bottom)
  setSplitX: (x: number) => void;
  setSplitY: (y: number) => void;
}

export const useSnapLayout = create<SnapLayoutState>((set) => ({
  splitX: 0.5,
  splitY: 0.5,
  setSplitX: (x) => set({ splitX: Math.max(0.2, Math.min(0.8, x)) }),
  setSplitY: (y) => set({ splitY: Math.max(0.2, Math.min(0.8, y)) }),
}));
