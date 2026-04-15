import React, { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { SKILL_CATEGORY_THEME } from "../../constants/theme";

interface SkillSummary {
  category: string;
  employeeCount: number;
  avgLevel: number;
}

interface SkillsCategoryChartProps {
  allSkills: SkillSummary[];
}

export const SkillsCategoryChart = memo(({ allSkills }: SkillsCategoryChartProps) => {
  const categoryData = useMemo(() => {
    const cats: Record<string, any> = {};
    allSkills.forEach((s: any) => {
      if (!cats[s.category]) cats[s.category] = { count: 0, employees: 0, totalLevel: 0 };
      cats[s.category].count++;
      cats[s.category].employees += s.employeeCount;
      cats[s.category].totalLevel += s.avgLevel * s.employeeCount;
    });
    const maxCount = Math.max(...Object.values(cats).map((c) => c.count), 1);
    return Object.entries(cats)
      .map(([cat, data]) => ({
        category: cat,
        skillCount: data.count,
        employeeCount: data.employees,
        avgLevel: data.employees > 0 ? data.totalLevel / data.employees : 0,
        pct: (data.count / maxCount) * 100,
        theme: SKILL_CATEGORY_THEME[cat] || { hex: "#9ca3af" },
      }))
      .sort((a, b) => b.skillCount - a.skillCount);
  }, [allSkills]);

  return (
    <Box sx={{ "& > * + *": { mt: 1 } }}>
      {categoryData.map((cat) => (
        <Box key={cat.category} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            component="span"
            sx={{
              width: 112,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: "0.75rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              bgcolor: cat.theme.hex ? `${cat.theme.hex}20` : "#f3f4f6",
              color: cat.theme.hex || "#374151",
            }}
          >
            {cat.category}
          </Box>
          <Box sx={{ flex: 1, height: 20, bgcolor: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                borderRadius: "9999px",
                transition: "width 0.3s",
                width: `${Math.min(cat.pct, 100)}%`,
                bgcolor: cat.theme.hex || "#9ca3af",
              }}
            />
          </Box>
          <Typography
            component="span"
            sx={{ width: 40, textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: "text.primary" }}
          >
            {cat.skillCount}
          </Typography>
          <Typography
            component="span"
            sx={{ width: 64, textAlign: "right", fontSize: "0.75rem", color: "text.secondary" }}
          >
            {cat.employeeCount} empl.
          </Typography>
        </Box>
      ))}
    </Box>
  );
});
SkillsCategoryChart.displayName = "SkillsCategoryChart";
