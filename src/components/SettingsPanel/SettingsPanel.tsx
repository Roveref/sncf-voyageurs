/**
 * SettingsPanel — Admin dialog for editing var_config entries.
 *
 * Fetches all var_config rows from the backend, groups them by category,
 * and provides inline editing, creation, and deletion.
 */

import { memo, useState, useEffect, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { apiFetch } from "../../services/api";

const API_BASE = "/api/config";

interface ConfigEntry {
  key: string;
  value: string;
}

interface ConfigData {
  categories: Record<string, ConfigEntry[]>;
}

// ── Row for an existing entry ──

const EntryRow = memo(function EntryRow({
  category,
  entry,
  onSaved,
  onDeleted,
}: {
  category: string;
  entry: ConfigEntry;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [value, setValue] = useState(entry.value);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = value !== entry.value;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/${encodeURIComponent(category)}/${encodeURIComponent(entry.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch {
      // Error silently handled — the user sees the value didn't change
    } finally {
      setSaving(false);
    }
  }, [category, entry.key, value, onSaved]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`${API_BASE}/${encodeURIComponent(category)}/${encodeURIComponent(entry.key)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      onDeleted();
    } catch {
      // Error silently handled
    } finally {
      setDeleting(false);
    }
  }, [category, entry.key, onDeleted]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        py: 0.5,
      }}
    >
      <TextField
        size="small"
        label="Key"
        value={entry.key}
        disabled
        sx={{ flex: "0 0 200px" }}
        slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: "0.85rem" } } }}
      />
      <TextField
        size="small"
        label="Value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        sx={{ flex: 1 }}
        slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: "0.85rem" } } }}
      />
      <Tooltip title="Enregistrer">
        <span>
          <IconButton size="small" color="primary" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Supprimer">
        <span>
          <IconButton size="small" color="error" disabled={deleting} onClick={handleDelete}>
            {deleting ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
});
EntryRow.displayName = "EntryRow";

// ── Inline form for adding a new entry ──

const AddEntryForm = memo(function AddEntryForm({ category, onAdded }: { category: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/${encodeURIComponent(category)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error || "Request failed");
        return;
      }
      setKey("");
      setValue("");
      setOpen(false);
      onAdded();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, [category, key, value, onAdded]);

  if (!open) {
    return (
      <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 0.5 }}>
        Add entry
      </Button>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
      <TextField
        size="small"
        label="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        sx={{ flex: "0 0 200px" }}
        autoFocus
        slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: "0.85rem" } } }}
      />
      <TextField
        size="small"
        label="Value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        sx={{ flex: 1 }}
        slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: "0.85rem" } } }}
      />
      <Button size="small" variant="contained" disabled={!key.trim() || saving} onClick={handleAdd}>
        {saving ? <CircularProgress size={18} /> : "Add"}
      </Button>
      <Button
        size="small"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
      >
        Cancel
      </Button>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
});
AddEntryForm.displayName = "AddEntryForm";

// ── Main dialog ──

const SettingsPanel = memo(function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch(API_BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const categories = data?.categories ?? {};
  const categoryNames = Object.keys(categories).sort();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { maxHeight: "85vh" },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
        }}
      >
        <Typography variant="h6" component="span" fontWeight={700}>
          Configuration (var_config)
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {fetchError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {fetchError}
          </Alert>
        )}

        {!loading && !fetchError && categoryNames.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            No configuration entries found.
          </Typography>
        )}

        {categoryNames.map((cat) => (
          <Accordion key={cat} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography fontWeight={600}>{cat}</Typography>
                <Chip label={categories[cat].length} size="small" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {categories[cat].map((entry) => (
                <EntryRow key={entry.key} category={cat} entry={entry} onSaved={fetchConfig} onDeleted={fetchConfig} />
              ))}
              <AddEntryForm category={cat} onAdded={fetchConfig} />
            </AccordionDetails>
          </Accordion>
        ))}
      </DialogContent>
    </Dialog>
  );
});
SettingsPanel.displayName = "SettingsPanel";

export default SettingsPanel;
