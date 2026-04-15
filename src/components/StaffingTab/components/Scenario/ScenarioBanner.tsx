import React, { memo, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ScienceIcon from "@mui/icons-material/Science";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import useScenarioStore from "../../../../stores/useScenarioStore";

interface Props {
  deltaTU?: number;
  realTU?: number;
  scenarioTU?: number;
}

const ScenarioBanner = memo(({ deltaTU = 0, realTU = 0, scenarioTU = 0 }: Props) => {
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const setActive = useScenarioStore((s) => s.setActiveScenario);
  const [committing, setCommitting] = useState(false);

  const handleCommit = useCallback(async () => {
    if (!activeScenario || committing) return;
    setCommitting(true);
    try {
      // Deactivate scenario (commit logic will be reworked with editor-state branching)
      setActive(null);
    } catch {
      // Sync will retry
    } finally {
      setCommitting(false);
    }
  }, [activeScenario, committing, setActive]);

  if (!activeScenario) return null;

  const overrideCount =
    Object.keys(activeScenario.assignmentOverrides).length + Object.keys(activeScenario.employeeOverrides).length;
  const sign = deltaTU >= 0 ? "+" : "";
  const deltaColor = deltaTU > 0 ? "#047857" : deltaTU < 0 ? "#dc2626" : "#6b7280";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2.5,
        py: 1,
        borderRadius: 2,
        bgcolor: "#fffbeb",
        border: "1px solid #fbbf24",
        mb: 2,
      }}
    >
      {/* Left: scenario name */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ScienceIcon sx={{ fontSize: 18, color: "#92400e" }} />
        <Typography variant="body2" sx={{ fontWeight: 700, color: "#92400e" }}>
          {activeScenario.name}
        </Typography>
        {overrideCount > 0 && (
          <Chip
            label={`${overrideCount} modification${overrideCount > 1 ? "s" : ""}`}
            size="small"
            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 600, bgcolor: "#fef3c7", color: "#92400e" }}
          />
        )}
      </Box>

      {/* Center: TU delta */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
          Actual TU: <strong>{realTU.toFixed(1)}%</strong>
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
          →
        </Typography>
        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
          Scenario: <strong>{scenarioTU.toFixed(1)}%</strong>
        </Typography>
        {deltaTU !== 0 && (
          <Chip
            label={`${sign}${deltaTU.toFixed(1)} pts`}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.7rem",
              fontWeight: 700,
              bgcolor: deltaTU > 0 ? "#ecfdf5" : "#fef2f2",
              color: deltaColor,
            }}
          />
        )}
      </Box>

      {/* Right: commit + back buttons */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {overrideCount > 0 && (
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
            onClick={handleCommit}
            disabled={committing}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.75rem",
              bgcolor: "#047857",
              "&:hover": { bgcolor: "#065f46" },
            }}
          >
            {committing ? "Committing..." : `Commit (${overrideCount})`}
          </Button>
        )}
        <Button
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
          onClick={() => setActive(null)}
          sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", color: "#92400e" }}
        >
          Back to actual
        </Button>
      </Box>
    </Box>
  );
});

ScenarioBanner.displayName = "ScenarioBanner";
export default ScenarioBanner;
