import { useRef, type MutableRefObject } from "react";

/**
 * Returns `value` unchanged when not dragging.
 * While `isDraggingRef.current` is true, returns the last value that was
 * captured before the drag started — effectively freezing the output.
 *
 * This is cheaper than useDeferredValue because React never schedules a
 * deferred render at all: the downstream useMemo / components simply see
 * a stable reference and bail out entirely.
 */
export function useFrozenWhileDragging<T>(value: T, isDraggingRef: MutableRefObject<boolean>): T {
  const frozenRef = useRef(value);

  // Only update the frozen snapshot when NOT dragging
  if (!isDraggingRef.current) {
    frozenRef.current = value;
  }

  return frozenRef.current;
}
