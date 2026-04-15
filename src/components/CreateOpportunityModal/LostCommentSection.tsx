/**
 * LostCommentSection — Shown only when status is Lost
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";

interface LostCommentSectionProps {
  value: string;
  onChange: (field: string, value: any) => void;
}

const LostCommentSection = ({ value, onChange }: LostCommentSectionProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2.5,
      }}
    >
      <Box
        sx={{
          backgroundColor: alpha(theme.palette.error.main, 0.06),
          borderRadius: "8px",
          maxWidth: "95%",
          mx: "auto",
          p: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} color="error.main" sx={{ mb: 1.5 }}>
          Lost Comment
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder="Enter reason for loss..."
          value={value}
          onChange={(e) => onChange("lostComment", e.target.value)}
          variant="outlined"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              borderLeft: `3px solid ${theme.palette.error.main}`,
            },
          }}
        />
      </Box>
    </Box>
  );
};

LostCommentSection.displayName = "LostCommentSection";
export default memo(LostCommentSection);
