import React, { memo } from "react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";

/**
 * Weekend markers for timeline background
 */
export const WeekendMarkers = memo(({ markers }: any) => (
  <>
    {markers.map(({ key, position, width }: any) => (
      <Box
        key={`weekend-${key}`}
        sx={{
          position: "absolute",
          bgcolor: "divider",
          opacity: 0.4,
          left: `${position}%`,
          top: 0,
          width: `${width}%`,
          height: "100%",
          zIndex: 1,
        }}
      />
    ))}
  </>
));

WeekendMarkers.displayName = "WeekendMarkers";

/**
 * Holiday markers for timeline background
 */
export const HolidayMarkers = memo(({ markers }: any) => (
  <>
    {markers.map(({ key, date, position, width }: any) => (
      <Box
        key={`holiday-${key}`}
        sx={{
          position: "absolute",
          bgcolor: "info.light",
          opacity: 0.3,
          left: `${position}%`,
          top: 0,
          width: `${width}%`,
          height: "100%",
          zIndex: 2,
        }}
        title={`Public Holiday: ${date}`}
      />
    ))}
  </>
));

HolidayMarkers.displayName = "HolidayMarkers";

/**
 * Grid lines for timeline
 */
export const GridLines = memo(({ labels }: any) => (
  <>
    {labels.map((label: any, index: number) => (
      <Box
        key={`grid-${index}`}
        sx={{
          position: "absolute",
          width: "1px",
          bgcolor: "divider",
          opacity: 0.4,
          left: `${label.position}%`,
          top: 0,
          height: "100%",
          zIndex: 3,
        }}
      />
    ))}
  </>
));

GridLines.displayName = "GridLines";

/**
 * Month labels header
 */
export const MonthLabels = memo(({ labels }: any) => (
  <Box sx={{ position: "relative", height: 32, mb: 1.5 }}>
    {labels.map(({ key, label, startPos, width }: any) => (
      <Box
        key={`month-${key}`}
        sx={{
          position: "absolute",
          bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
          color: "info.dark",
          fontSize: "14px",
          fontWeight: 500,
          borderLeft: (theme) => `1px solid ${theme.palette.info.light}`,
          left: `calc(${startPos}% - 4px)`,
          width: `calc(${width}% + 4px)`,
          top: 0,
          height: "32px",
          pl: 1,
          pt: 0.5,
        }}
      >
        {label}
      </Box>
    ))}
  </Box>
));

MonthLabels.displayName = "MonthLabels";

/**
 * Combined timeline background component
 */
export const TimelineBackground = memo(({ weekendMarkers, holidayMarkers, labels, showGrid = true }: any) => (
  <>
    <WeekendMarkers markers={weekendMarkers} />
    <HolidayMarkers markers={holidayMarkers} />
    {showGrid && <GridLines labels={labels} />}
  </>
));

TimelineBackground.displayName = "TimelineBackground";
