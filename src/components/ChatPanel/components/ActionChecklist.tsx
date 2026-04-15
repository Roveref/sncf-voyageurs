import { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import type { ChatAction } from "./ChatMarkdown";

interface ActionChecklistProps {
  actions: ChatAction[];
  onValidate: (checked: ChatAction[]) => void;
  accent: string;
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

const ActionChecklist = memo(({ actions, onValidate, accent, isDark, warm }: ActionChecklistProps) => {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(actions.map((_, i) => i)));

  const toggle = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleValidate = useCallback(() => {
    const selected = actions.filter((_, i) => checked.has(i));
    if (selected.length > 0) onValidate(selected);
  }, [actions, checked, onValidate]);

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${warm.border}`,
        overflow: "hidden",
        p: 1.5,
      }}
    >
      {actions.map((a, i) => (
        <Box
          key={i}
          onClick={() => toggle(i)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            cursor: "pointer",
            px: 1,
            py: 0.25,
            borderRadius: 1,
            "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" },
            transition: "background-color 0.15s ease",
          }}
        >
          <Checkbox
            checked={checked.has(i)}
            size="small"
            sx={{ color: warm.muted, "&.Mui-checked": { color: accent }, p: 0.5 }}
          />
          <Typography
            sx={{
              fontSize: 12.5,
              fontWeight: 500,
              color: checked.has(i) ? warm.text : warm.muted,
              textDecoration: checked.has(i) ? "none" : "line-through",
              flex: 1,
            }}
          >
            {a.label}
          </Typography>
        </Box>
      ))}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          size="small"
          variant="contained"
          disabled={checked.size === 0}
          onClick={handleValidate}
          sx={{
            textTransform: "none",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: "20px",
            px: 2.5,
            py: 0.5,
            bgcolor: accent,
            "&:hover": { bgcolor: accent, filter: "brightness(0.9)" },
            "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" },
          }}
        >
          Valider ({checked.size}/{actions.length})
        </Button>
      </Box>
    </Box>
  );
});
ActionChecklist.displayName = "ActionChecklist";

export { ActionChecklist };
