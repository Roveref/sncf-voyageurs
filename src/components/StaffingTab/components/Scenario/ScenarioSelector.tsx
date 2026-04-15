import React, { memo, useState, useCallback } from "react";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ScienceIcon from "@mui/icons-material/Science";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import useScenarioStore from "../../../../stores/useScenarioStore";
import { useUserDataStore } from "../../../../stores/useUserDataStore";

interface Props {
  onCreateClick: () => void;
  onCompareClick?: () => void;
}

const ScenarioSelector = memo(({ onCreateClick, onCompareClick }: Props) => {
  const scenarios = useScenarioStore((s) => s.scenarios);
  const activeId = useScenarioStore((s) => s.activeScenarioId);
  const setActive = useScenarioStore((s) => s.setActiveScenario);
  const deleteScenario = useScenarioStore((s) => s.deleteScenario);
  const duplicateScenario = useScenarioStore((s) => s.duplicateScenario);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleSelect = useCallback(
    (id: string | null) => {
      setActive(id);
      setAnchorEl(null);
    },
    [setActive]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const wasActive = id === useScenarioStore.getState().activeScenarioId;
      deleteScenario(id);
      if (wasActive) useUserDataStore.getState().setEditorStates({});
    },
    [deleteScenario]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const sc = scenarios.find((s) => s.id === id);
      if (sc) duplicateScenario(id, `${sc.name} (copie)`);
    },
    [scenarios, duplicateScenario]
  );

  const activeScenario = activeId ? scenarios.find((s) => s.id === activeId) : null;

  return (
    <>
      <Chip
        icon={<ScienceIcon sx={{ fontSize: 16 }} />}
        label={activeScenario ? activeScenario.name : "Actual data"}
        size="small"
        onClick={handleClick}
        sx={{
          fontWeight: 600,
          fontSize: "0.75rem",
          height: 28,
          bgcolor: activeScenario ? "#fef3c7" : "#ecfdf5",
          color: activeScenario ? "#92400e" : "#047857",
          border: "1px solid",
          borderColor: activeScenario ? "#fbbf24" : "#6ee7b7",
          cursor: "pointer",
          "&:hover": { opacity: 0.85 },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 280, maxWidth: 380 } } }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Scenarios
          </Typography>
        </Box>
        <List dense disablePadding>
          {/* Real data option */}
          <ListItemButton selected={!activeId} onClick={() => handleSelect(null)} sx={{ px: 2, py: 0.75 }}>
            <ListItemText
              primary="Actual data"
              primaryTypographyProps={{ fontWeight: !activeId ? 700 : 400, fontSize: "0.8rem" }}
            />
            {!activeId && <CheckCircleIcon sx={{ fontSize: 16, color: "#047857" }} />}
          </ListItemButton>

          {scenarios.length > 0 && <Divider />}

          {/* Scenario list */}
          {scenarios.map((sc) => {
            const isActive = activeId === sc.id;
            const baseName = sc.baseScenarioId
              ? scenarios.find((s) => s.id === sc.baseScenarioId)?.name || "deleted scenario"
              : "actual";
            return (
              <ListItemButton
                key={sc.id}
                selected={isActive}
                onClick={() => handleSelect(sc.id)}
                sx={{ px: 2, py: 0.75 }}
              >
                <ListItemText
                  primary={sc.name}
                  secondary={`Base: ${baseName} · ${new Date(sc.updatedAt).toLocaleDateString()}`}
                  primaryTypographyProps={{ fontWeight: isActive ? 700 : 400, fontSize: "0.8rem" }}
                  secondaryTypographyProps={{ fontSize: "0.65rem" }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Duplicate">
                    <IconButton size="small" onClick={(e) => handleDuplicate(e, sc.id)}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={(e) => handleDelete(e, sc.id)}>
                      <DeleteOutlineIcon sx={{ fontSize: 14, color: "error.main" }} />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItemButton>
            );
          })}
        </List>

        <Divider />
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Button
            fullWidth
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              handleClose();
              onCreateClick();
            }}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
          >
            New scenario
          </Button>
          {scenarios.length > 0 && onCompareClick && (
            <Button
              fullWidth
              size="small"
              startIcon={<CompareArrowsIcon />}
              onClick={() => {
                handleClose();
                onCompareClick();
              }}
              sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}
            >
              Compare
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
});

ScenarioSelector.displayName = "ScenarioSelector";
export default ScenarioSelector;
