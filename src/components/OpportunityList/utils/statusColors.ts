import { alpha, Theme } from "@mui/material/styles";

/** Get status color — aligned with OpportunityRow palette */
export const getStatusColor = (status: number, theme: Theme) => {
  switch (status) {
    case 1: // Lead Identified — primary (rouge BP)
      return {
        bgcolor: alpha(theme.palette.primary.main, 0.12),
        color: theme.palette.primary.dark,
        headerBg: theme.palette.primary.main,
      };
    case 4: // Go Approved — warning (ambre)
      return {
        bgcolor: alpha(theme.palette.warning.main, 0.12),
        color: theme.palette.warning.dark,
        headerBg: theme.palette.warning.main,
      };
    case 6: // Proposal Submitted — info (warm grey)
      return {
        bgcolor: alpha(theme.palette.info.main, 0.12),
        color: theme.palette.info.dark,
        headerBg: theme.palette.info.main,
      };
    case 11: // Client Won — success (vert)
    case 13: // AEL
      return {
        bgcolor: alpha(theme.palette.success.main, 0.12),
        color: theme.palette.success.dark,
        headerBg: theme.palette.success.main,
      };
    case 14: // Booked — success dark (deep green)
      return {
        bgcolor: alpha(theme.palette.success.dark, 0.15),
        color: theme.palette.success.dark,
        headerBg: theme.palette.success.dark,
      };
    case 15: // Lost — error (bordeaux)
      return {
        bgcolor: alpha(theme.palette.error.main, 0.1),
        color: theme.palette.error.dark,
        headerBg: theme.palette.error.main,
      };
    default:
      return {
        bgcolor: alpha(theme.palette.grey[500], 0.12),
        color: theme.palette.grey[700],
        headerBg: theme.palette.grey[500],
      };
  }
};
