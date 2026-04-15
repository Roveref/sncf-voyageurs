import React, { memo, useRef, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import { useIsDetached } from "../../../../components/shared";

interface StickyTimelineHeaderProps {
  stickyTop: number;
  visible: boolean;
  onStuckChange?: (stuck: boolean) => void;
  children: React.ReactNode;
}

export const StickyTimelineHeader = memo(
  ({ stickyTop: rawStickyTop, visible, onStuckChange, children }: StickyTimelineHeaderProps) => {
    // In PiP mode, sticky is relative to the PiP scroll container (top: 0)
    const isDetached = useIsDetached();
    const stickyTop = isDetached ? 0 : rawStickyTop;
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [isStuck, setIsStuck] = useState(false);
    const onStuckChangeRef = useRef(onStuckChange);
    onStuckChangeRef.current = onStuckChange;

    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          const stuck = !entry.isIntersecting;
          setIsStuck(stuck);
          onStuckChangeRef.current?.(stuck);
        },
        { threshold: 0, rootMargin: `-${stickyTop + 1}px 0px 0px 0px` }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [stickyTop, visible]);

    if (!visible) return null;

    return (
      <>
        <Box ref={sentinelRef} sx={{ height: 0, visibility: "hidden" }} />
        {/* Opaque strip covering gap between TopToolbar and this header */}
        <Box
          sx={{
            position: "sticky",
            top: stickyTop - 24,
            zIndex: 8,
            height: 24,
            mx: -3, // bleed into Paper padding zone
            bgcolor: "background.default",
            pointerEvents: "none",
            mb: "-24px",
          }}
        />
        <Box
          sx={{
            position: "sticky",
            top: stickyTop,
            zIndex: 9,
            isolation: "isolate",
          }}
        >
          {/* Blur layer — fades out at bottom, mirrors TopToolbar's blur effect */}
          {isStuck && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: -24,
                right: -24,
                bottom: -24,
                zIndex: 0,
                maskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                pointerEvents: "none",
              }}
            />
          )}
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              bgcolor: "background.paper",
              overflow: "visible",
              borderRadius: isStuck ? "0 0 24px 24px" : 0,
              transition: "box-shadow 0.3s ease, border-radius 0.3s ease",
              boxShadow: isStuck ? "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)" : "none",
              px: 3,
              py: 1,
            }}
          >
            {children}
          </Box>
        </Box>
      </>
    );
  }
);

StickyTimelineHeader.displayName = "StickyTimelineHeader";
