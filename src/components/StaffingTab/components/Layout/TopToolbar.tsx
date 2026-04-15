import React, { memo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import StaffingDateRangeFilter from "./StaffingDateRangeFilter";

const subscribeScroll = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const getScrollY = () => window.scrollY;
const getServerScrollY = () => 0;
/** Reactive window.scrollY — updates on scroll AND on re-render (covers tab switches). */
const useScrollY = () => useSyncExternalStore(subscribeScroll, getScrollY, getServerScrollY);

interface TopToolbarProps {
  toolbarRef?: React.Ref<HTMLDivElement>;
  timelineSentinelRef?: React.RefObject<HTMLDivElement | null>;
  timelineHeaderTop?: number;
  timeframe: string;
  customDateRange: any;
  onTimeframeChange: (value: string) => void;
  timelineStart: any;
  timelineEnd: any;
  setCustomDateRangeDirect: any;
  resetTimeline: () => void;
  granularity: string;
  onGranularityChange: (value: string) => void;
  heatmapMode: string;
  onHeatmapModeChange: (value: string) => void;
  chargeableCombined: boolean;
  onChargeableCombinedChange: (value: boolean) => void;
  dataSourceDebug?: string;
  onDataSourceDebugChange?: any;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchScope?: string;
  onSearchScopeChange?: (scope: string) => void;
  searchEmployees?: any[];
  searchTags?: Array<{ text: string; type: string }>;
  onSearchTagsChange?: (tags: Array<{ text: string; type: string }>) => void;
  onReset: () => void;
  hasSapData: boolean;
  autoSort: boolean;
  onAutoSortToggle: () => void;
  pipelineJobcodes?: Map<string, any> | null;
}

const STICKY_TOP = 80;

export const TopToolbar = memo(
  ({
    toolbarRef,
    timelineSentinelRef,
    timelineHeaderTop,
    // Timeframe / DateRange
    timeframe,
    customDateRange,
    onTimeframeChange,
    timelineStart,
    timelineEnd,
    setCustomDateRangeDirect,
    resetTimeline,
    // Granularity
    granularity,
    onGranularityChange,
    // Heatmap
    heatmapMode,
    onHeatmapModeChange,
    // Chargeable
    chargeableCombined,
    onChargeableCombinedChange,
    // Debug data source
    dataSourceDebug,
    onDataSourceDebugChange,
    // Search
    searchValue,
    onSearchChange,
    searchScope,
    onSearchScopeChange,
    searchEmployees,
    searchTags,
    onSearchTagsChange,
    // Reset
    onReset,
    // SAP
    hasSapData,
    // Sort
    autoSort,
    onAutoSortToggle,
    // Pipeline
    pipelineJobcodes,
  }: TopToolbarProps) => {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const scrollY = useScrollY();
    const isStuck = scrollY > 0;
    const [merged, setMerged] = useState(false);

    // Detect when the timeline header merges — only after toolbar is stuck (scrolled)
    useEffect(() => {
      if (!timelineHeaderTop) return;
      let last = false;
      const onScroll = () => {
        const sentinel = timelineSentinelRef?.current;
        if (!sentinel) return;
        if (!isStuck) {
          if (last) {
            last = false;
            setMerged(false);
          }
          return;
        }
        const isMerged = sentinel.getBoundingClientRect().top <= timelineHeaderTop;
        if (isMerged !== last) {
          last = isMerged;
          setMerged(isMerged);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, [timelineHeaderTop, timelineSentinelRef, isStuck]);

    return (
      <>
        {/* Invisible sentinel — when it scrolls above the sticky offset, toolbar is stuck */}
        <Box ref={sentinelRef} sx={{ height: 0, visibility: "hidden" }} />
        {/* Opaque strip covering the gap between AppBar and toolbar + corner mask area */}
        <Box
          sx={{
            position: "sticky",
            top: 64,
            zIndex: 9,
            height: merged ? STICKY_TOP - 64 + 24 : STICKY_TOP - 64, // extend 24px into toolbar zone to cover rounded corners
            mx: -3,
            bgcolor: "background.default",
            pointerEvents: "none",
            mb: merged ? `${-(STICKY_TOP - 64) - 24}px` : `${-(STICKY_TOP - 64)}px`,
            borderRadius: merged ? "0 0 24px 24px" : 0,
            transition: "border-radius 0.3s ease, height 0.3s ease, margin-bottom 0.3s ease",
          }}
        />
        <Box
          ref={toolbarRef}
          sx={{
            mb: 3,
            position: "sticky",
            top: STICKY_TOP,
            zIndex: 10,
            isolation: "isolate", // new stacking context so toolbar stays above siblings
            // When merged with timeline header, clip the bottom overflow (shadow + blur fade)
            ...(merged && { clipPath: "inset(-20px -20px 0px -20px)" }),
          }}
        >
          {/* Blur layer behind the toolbar — fades out at bottom, hidden when timeline header merges */}
          {isStuck && !merged && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: -24,
                right: -24,
                bottom: -24, // extend below for fade zone
                zIndex: 0,
                maskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                pointerEvents: "none",
              }}
            />
          )}
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <StaffingDateRangeFilter
              isStuck={isStuck}
              merged={merged}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              timeframe={timeframe}
              customDateRange={customDateRange}
              onTimeframeChange={onTimeframeChange}
              setCustomDateRangeDirect={setCustomDateRangeDirect}
              resetTimeline={resetTimeline}
              granularity={granularity}
              onGranularityChange={onGranularityChange}
              heatmapMode={heatmapMode}
              onHeatmapModeChange={onHeatmapModeChange}
              chargeableCombined={chargeableCombined}
              onChargeableCombinedChange={onChargeableCombinedChange}
              dataSourceDebug={dataSourceDebug}
              onDataSourceDebugChange={onDataSourceDebugChange}
              searchValue={searchValue}
              onSearchChange={onSearchChange}
              searchScope={searchScope}
              onSearchScopeChange={onSearchScopeChange}
              searchEmployees={searchEmployees}
              searchTags={searchTags}
              onSearchTagsChange={onSearchTagsChange}
              onReset={onReset}
              hasSapData={hasSapData}
              autoSort={autoSort}
              onAutoSortToggle={onAutoSortToggle}
              pipelineJobcodes={pipelineJobcodes}
            />
          </Box>
        </Box>
      </>
    );
  }
);

TopToolbar.displayName = "TopToolbar";
