import React, { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import { getGradeColor, compareGrades, SUB_TEAM_COLORS } from "../../constants";

export const SkillsCoverageMatrix = memo(({ employees, allSkills }: any) => {
  const [groupBy, setGroupBy] = useState("grade"); // 'grade' | 'subTeam'
  const [hovered, setHovered] = useState(null);
  const topN = 25;

  const topSkills = useMemo(() => allSkills.slice(0, topN), [allSkills]);

  const { matrix, segments } = useMemo(() => {
    // Build segment list
    const segMap: Record<string, string> = {};
    employees.forEach((emp: any) => {
      const key = groupBy === "grade" ? emp.grade : emp.subTeam;
      if (key && !segMap[key]) segMap[key] = key;
    });
    const segs = groupBy === "grade" ? Object.keys(segMap).sort(compareGrades) : Object.keys(segMap).sort();

    // Build matrix: for each skill x segment, compute avg level + count
    const mx: Record<string, Record<string, any>> = {};
    topSkills.forEach((skill: any) => {
      mx[skill.skillShort] = {};
      segs.forEach((seg) => {
        mx[skill.skillShort][seg] = { levels: [], count: 0 };
      });
    });

    employees.forEach((emp: any) => {
      if (!emp.skills) return;
      const seg = groupBy === "grade" ? emp.grade : emp.subTeam;
      if (!seg || !segs.includes(seg)) return;
      emp.skills.forEach((s: any) => {
        if (mx[s.skillShort] && mx[s.skillShort][seg]) {
          mx[s.skillShort][seg].levels.push(s.level);
          mx[s.skillShort][seg].count++;
        }
      });
    });

    // Compute averages
    Object.values(mx).forEach((row) => {
      Object.values(row).forEach((cell) => {
        cell.avg =
          cell.levels.length > 0 ? cell.levels.reduce((a: number, b: number) => a + b, 0) / cell.levels.length : -1;
      });
    });

    return { matrix: mx, segments: segs };
  }, [employees, topSkills, groupBy]);

  const getSegColor = (seg: any): any => {
    if (groupBy === "grade") return getGradeColor(seg);
    return SUB_TEAM_COLORS[seg] || { hex: "#9ca3af" };
  };

  const getCellBgColor = (avg: number) => {
    if (avg < 0) return "#f9fafb";
    const level = Math.round(avg);
    const colors: Record<number, string> = {
      0: "#f3f4f6",
      1: "#e0f2fe",
      2: "#dbeafe",
      3: "#e0e7ff",
      4: "#f3e8ff",
    };
    return colors[level] || "#f9fafb";
  };

  if (topSkills.length === 0 || segments.length === 0) {
    return (
      <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", textAlign: "center", py: 4 }}>
        Not enough data for the matrix
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Coverage Matrix
        </Typography>
        <Box sx={{ display: "flex", bgcolor: "#f3f4f6", borderRadius: 1, p: 0.25 }}>
          <Button
            size="small"
            onClick={() => setGroupBy("grade")}
            sx={{
              px: 1,
              py: 0.5,
              fontSize: "0.75rem",
              fontWeight: 500,
              borderRadius: 1,
              textTransform: "none",
              minWidth: "auto",
              ...(groupBy === "grade"
                ? { bgcolor: "#fff", color: "#2563eb", boxShadow: 1 }
                : { color: "text.secondary", "&:hover": { color: "text.secondary" } }),
            }}
          >
            By Grade
          </Button>
          <Button
            size="small"
            onClick={() => setGroupBy("subTeam")}
            sx={{
              px: 1,
              py: 0.5,
              fontSize: "0.75rem",
              fontWeight: 500,
              borderRadius: 1,
              textTransform: "none",
              minWidth: "auto",
              ...(groupBy === "subTeam"
                ? { bgcolor: "#fff", color: "#2563eb", boxShadow: 1 }
                : { color: "text.secondary", "&:hover": { color: "text.secondary" } }),
            }}
          >
            By Team
          </Button>
        </Box>
      </Box>

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { fontSize: "0.75rem" } }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 500,
                  color: "text.secondary",
                  position: "sticky",
                  left: 0,
                  bgcolor: "#fff",
                  width: 128,
                  zIndex: 1,
                }}
              >
                Skill
              </TableCell>
              {segments.map((seg) => {
                const c = getSegColor(seg);
                return (
                  <TableCell key={seg} align="center" sx={{ fontWeight: 500, minWidth: 50 }}>
                    <Box
                      component="span"
                      sx={{
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: "9px",
                        bgcolor: c.hex ? `${c.hex}20` : "#f3f4f6",
                        color: c.hex || "#374151",
                      }}
                    >
                      {seg}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {topSkills.map((skill: any) => (
              <TableRow key={skill.skillShort} sx={{ borderTop: "1px solid #f3f4f6" }}>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    color: "text.secondary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    position: "sticky",
                    left: 0,
                    bgcolor: "#fff",
                    zIndex: 1,
                  }}
                  title={skill.skillFull}
                >
                  {skill.skillShort}
                </TableCell>
                {segments.map((seg) => {
                  const cell = matrix[skill.skillShort]?.[seg];
                  if (!cell || cell.avg < 0) {
                    return (
                      <TableCell key={seg} align="center" sx={{ color: "#d1d5db" }}>
                        --
                      </TableCell>
                    );
                  }
                  return (
                    <Tooltip
                      key={seg}
                      title={`${skill.skillFull} x ${seg}: avg. lvl. ${cell.avg.toFixed(1)}, ${cell.count} empl.`}
                      arrow
                    >
                      <TableCell align="center" sx={{ position: "relative" }}>
                        <Box
                          component="span"
                          sx={{
                            display: "inline-block",
                            width: "100%",
                            py: 0.25,
                            borderRadius: 1,
                            fontWeight: 600,
                            fontSize: "10px",
                            bgcolor: getCellBgColor(cell.avg),
                          }}
                        >
                          {cell.avg.toFixed(1)}
                          <Typography component="span" sx={{ fontSize: "8px", color: "text.disabled", ml: 0.25 }}>
                            ({cell.count})
                          </Typography>
                        </Box>
                      </TableCell>
                    </Tooltip>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});
SkillsCoverageMatrix.displayName = "SkillsCoverageMatrix";
