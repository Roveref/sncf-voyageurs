import { create } from "zustand";
import { devtools } from "zustand/middleware";

const MAX_STACK_SIZE = 20;

export interface UndoAction {
  id: string;
  label: string;
  undo: () => void;
  timestamp: number;
}

interface UndoState {
  stack: UndoAction[];
  push: (label: string, undoFn: () => void) => void;
  pop: () => UndoAction | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoState>()(
  devtools(
    (set, get) => ({
      stack: [],

      push: (label, undoFn) => {
        const action: UndoAction = {
          id: crypto.randomUUID(),
          label,
          undo: undoFn,
          timestamp: Date.now(),
        };
        set((s) => {
          const next = [...s.stack, action];
          return { stack: next.length > MAX_STACK_SIZE ? next.slice(next.length - MAX_STACK_SIZE) : next };
        });
      },

      pop: () => {
        const { stack } = get();
        if (stack.length === 0) return undefined;
        const last = stack[stack.length - 1];
        set((s) => ({ stack: s.stack.slice(0, -1) }));
        return last;
      },

      clear: () => set({ stack: [] }),
    }),
    { name: "UndoStore" }
  )
);
