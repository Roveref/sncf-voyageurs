import { useState, useRef, useEffect } from "react";

/**
 * Measures the TopToolbar height via ResizeObserver and derives the
 * `timelineHeaderTop` offset used by StickyTimelineHeader.
 * Also owns the toolbarWrapperRef and timelineSentinelRef that are passed
 * as DOM refs into the render tree.
 */
export function useStaffingToolbarOffset() {
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);
  const timelineSentinelRef = useRef<HTMLDivElement | null>(null);
  const [timelineHeaderTop, setTimelineHeaderTop] = useState(148); // sensible default

  useEffect(() => {
    const el = toolbarWrapperRef.current;
    if (!el) return;
    const update = () => setTimelineHeaderTop(80 + el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { toolbarWrapperRef, timelineSentinelRef, timelineHeaderTop };
}
