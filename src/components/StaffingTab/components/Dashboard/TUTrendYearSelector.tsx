import React, { memo, useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import { chartPalette, brand } from "../../../../config/brandConfig";

// Year palette (GAIF brand tones, newest year gets strongest color)
export const YEAR_COLORS = [...chartPalette];

/** Hook to manage year selection — share between TUOverview header and chart */
export const useTrendYears = () => {
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const initYears = useCallback((years: number[]) => {
    const sorted = [...years].sort((a, b) => a - b);
    setAvailableYears(sorted);
    setSelectedYears((prev) => {
      if (prev.length > 0) return prev.filter((y) => sorted.includes(y));
      // Default: current year + previous year
      const cur = new Date().getFullYear();
      const defaults = sorted.filter((y) => y === cur || y === cur - 1);
      return defaults.length > 0 ? defaults : sorted.slice(-2);
    });
  }, []);

  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort((a, b) => a - b)
    );
  }, []);

  const yearColors = useMemo(() => {
    const colors: Record<number, string> = {};
    availableYears.forEach((y) => {
      colors[y] = brand.secondary;
    }); // G60 — uniform neutral
    return colors;
  }, [availableYears]);

  return { selectedYears, availableYears, yearColors, initYears, toggleYear };
};

/** Year selector — Chip badges with dot indicator (BookingsTab style) */
export const TUTrendYearSelector = memo(
  ({
    selectedYears,
    availableYears,
    yearColors,
    onToggle,
  }: {
    selectedYears: number[];
    availableYears: number[];
    yearColors: Record<number, string>;
    onToggle: (y: number) => void;
  }) => {
    if (availableYears.length <= 1) return null;
    return (
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
        {availableYears.map((year) => {
          const on = selectedYears.includes(year);
          const color = yearColors[year] || "#999";
          return (
            <Chip
              key={year}
              label={String(year)}
              size="small"
              onClick={() => onToggle(year)}
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: on ? 600 : 400,
                color: on ? "white" : "text.secondary",
                bgcolor: on ? color : alpha(color, 0.08),
                border: "none",
                transition: "background-color 0.2s ease-in-out, color 0.2s ease-in-out, transform 0.2s ease-in-out",
                position: "relative",
                pl: 2.5,
                "&:hover": {
                  bgcolor: on ? color : alpha(color, 0.15),
                  transform: "scale(1.05)",
                },
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 8,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: on ? "white" : color,
                },
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          );
        })}
      </Box>
    );
  }
);
TUTrendYearSelector.displayName = "TUTrendYearSelector";
