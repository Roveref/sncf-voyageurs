import React, { memo, useState, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Box from "@mui/material/Box";
import useScenarioStore from "../../../../stores/useScenarioStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ScenarioCreateDialog = memo(({ open, onClose }: Props) => {
  const scenarios = useScenarioStore((s) => s.scenarios);
  const createScenario = useScenarioStore((s) => s.createScenario);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseId, setBaseId] = useState<string>("__real__");

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;
    createScenario(name.trim(), baseId === "__real__" ? null : baseId, description.trim() || undefined);
    setName("");
    setDescription("");
    setBaseId("__real__");
    onClose();
  }, [name, description, baseId, createScenario, onClose]);

  const handleClose = useCallback(() => {
    setName("");
    setDescription("");
    setBaseId("__real__");
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} TransitionComponent={DialogTransition} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New scenario</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            label="Scenario name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Based on</InputLabel>
            <Select value={baseId} label="Based on" onChange={(e) => setBaseId(e.target.value)}>
              <MenuItem value="__real__">Actual data</MenuItem>
              {scenarios.map((sc) => (
                <MenuItem key={sc.id} value={sc.id}>
                  {sc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} size="small">
          Cancel
        </Button>
        <Button onClick={handleCreate} variant="contained" size="small" disabled={!name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ScenarioCreateDialog.displayName = "ScenarioCreateDialog";
export default ScenarioCreateDialog;
