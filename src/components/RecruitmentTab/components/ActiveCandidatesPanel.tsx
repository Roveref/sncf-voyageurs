import React, { useState, useMemo } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { alpha, useTheme } from "@mui/material/styles";
import type { RecruitmentCandidate } from "../../../types/recruitment";
import { computeProcessDurationDays } from "../utils/calculations";
import { parseJobPostings } from "../utils/serviceLineParser";

interface Props {
  candidates: RecruitmentCandidate[];
}

type SortKey = "name" | "poste" | "age" | "creationDate";

const ActiveCandidatesPanel = React.memo(({ candidates }: Props) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const enriched = useMemo(
    () =>
      candidates.map((c) => ({
        ...c,
        age: computeProcessDurationDays(c) ?? 0,
        serviceLines: parseJobPostings(c.jobPostings).slice(0, 3),
      })),
    [candidates]
  );

  const sorted = useMemo(() => {
    const arr = [...enriched];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        case "poste":
          return dir * a.poste.localeCompare(b.poste);
        case "age":
          return dir * (a.age - b.age);
        case "creationDate":
          return dir * a.creationDate.localeCompare(b.creationDate);
        default:
          return 0;
      }
    });
    return arr;
  }, [enriched, sortKey, sortDir]);

  const formatDate = (d: string) => {
    if (!d) return "-";
    return d.slice(0, 10).split("-").reverse().join("/");
  };

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h6" fontWeight={600}>
            Active candidates
          </Typography>
          <Chip label={candidates.length} size="small" color="info" />
        </Box>
        <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>
      <Collapse in={expanded}>
        <Divider sx={{ my: 2 }} />
        <TableContainer sx={{ maxHeight: 480 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={sortKey === "name"} direction={sortDir} onClick={() => handleSort("name")}>
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === "poste"} direction={sortDir} onClick={() => handleSort("poste")}>
                    Position
                  </TableSortLabel>
                </TableCell>
                <TableCell>Service lines</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "creationDate"}
                    direction={sortDir}
                    onClick={() => handleSort("creationDate")}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel active={sortKey === "age"} direction={sortDir} onClick={() => handleSort("age")}>
                    Age (d)
                  </TableSortLabel>
                </TableCell>
                <TableCell>Contact</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => (
                <TableRow
                  key={c.id}
                  sx={{
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                    ...(c.age > 90 ? { bgcolor: alpha(theme.palette.warning.main, 0.06) } : {}),
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {c.firstName} {c.lastName}
                      </Typography>
                      {c.linkedinUrl && (
                        <Tooltip title="LinkedIn">
                          <IconButton size="small" href={c.linkedinUrl} target="_blank" rel="noopener" sx={{ p: 0.25 }}>
                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={c.gradeBucket} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {c.serviceLines.map((sl) => (
                        <Chip
                          key={sl}
                          label={sl.length > 20 ? sl.slice(0, 18) + "..." : sl}
                          size="small"
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(c.creationDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={c.age > 90 ? 700 : 400}
                      color={c.age > 90 ? "warning.main" : "text.primary"}
                    >
                      {c.age}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11 }}>
                      {c.email}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
});
ActiveCandidatesPanel.displayName = "ActiveCandidatesPanel";

export default ActiveCandidatesPanel;
