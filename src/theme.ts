import { createTheme, Theme } from "@mui/material/styles";
import { brand, functional } from "./config/brandConfig";

// ── Design Tokens (exported for use in components) ──
export const designTokens = {
  // Standard alpha opacity levels
  alpha: { light: 0.04, medium: 0.08, strong: 0.12 },
  // Accent color for section titles, labels, non-CTA text
  accentText: brand.secondary,
  // Shadow token — MUI components default to "none"
  shadow: { none: "none" as const },
  // Primary color at common opacity levels (avoids hardcoded rgba across components)
  primaryAlpha: {
    12: `rgba(255,61,71,0.12)`,
    15: `rgba(255,61,71,0.15)`,
    18: `rgba(255,61,71,0.18)`,
    25: `rgba(255,61,71,0.25)`,
  },
};

/** Shared scrollbar-hidden style — used by body, html, #root */
const scrollbarHidden = {
  scrollbarWidth: "none" as const,
  "&::-webkit-scrollbar": { width: "0", height: "0.4rem" },
};

export const createAppTheme = (mode: "light" | "dark" = "light"): Theme => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: brand.primary,
        light: brand.primaryLight,
        dark: brand.primaryDark,
        contrastText: brand.white,
      },
      secondary: {
        main: brand.secondary,
        light: brand.secondaryLight,
        dark: brand.secondaryDark,
        contrastText: brand.white,
      },
      error: {
        main: brand.primaryDark,
        light: brand.primaryLight,
        dark: brand.primaryDeep,
      },
      warning: {
        main: functional.warning,
        light: functional.warningLight,
        dark: functional.warningDark,
      },
      info: {
        main: isDark ? brand.secondaryLighter : brand.secondaryLight,
        light: brand.secondaryLighter,
        dark: brand.secondary,
      },
      success: {
        main: functional.success,
        light: functional.successLight,
        dark: functional.successDark,
      },
      grey: {
        50: isDark ? brand.darkSurface : brand.background,
        100: isDark ? brand.darkBorder : brand.secondaryBg,
        200: isDark ? "#4A3F38" : brand.secondaryLightest,
        300: isDark ? brand.secondaryDark : brand.secondaryLighter,
        400: isDark ? brand.secondaryLight : brand.secondaryLight,
        500: brand.secondary,
        600: "#6B5A4E",
        700: brand.secondaryDark,
        800: brand.darkBorder,
        900: "#1F1915",
      },
      background: {
        default: isDark ? brand.darkBg : brand.background,
        paper: isDark ? brand.darkPaper : brand.white,
      },
      text: {
        primary: isDark ? "#EDE8E5" : brand.black,
        secondary: isDark ? brand.secondaryLighter : brand.secondary,
        disabled: isDark ? brand.secondaryDark : brand.secondaryLighter,
      },
      divider: isDark ? brand.darkBorder : brand.secondaryLightest,
    },
    typography: {
      fontFamily: brand.fontFamily,
      h1: {
        fontWeight: 700,
        fontSize: "2.5rem",
        lineHeight: 1.2,
      },
      h2: {
        fontWeight: 700,
        fontSize: "2rem",
        lineHeight: 1.2,
      },
      h3: {
        fontWeight: 600,
        fontSize: "1.75rem",
        lineHeight: 1.2,
      },
      h4: {
        fontWeight: 600,
        fontSize: "1.5rem",
        lineHeight: 1.3,
      },
      h5: {
        fontWeight: 600,
        fontSize: "1.25rem",
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 600,
        fontSize: "1.125rem",
        lineHeight: 1.4,
      },
      subtitle1: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.5,
      },
      subtitle2: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.5,
      },
      body2: {
        fontSize: "0.875rem",
        lineHeight: 1.5,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
      caption: {
        fontSize: "0.75rem",
        lineHeight: 1.5,
      },
      overline: {
        fontSize: "0.75rem",
        textTransform: "uppercase",
        fontWeight: 600,
        letterSpacing: 1,
      },
    },
    shape: {
      borderRadius: brand.borderRadius - 4,
    },
    shadows: [
      "none", // 0
      "0px 1px 2px rgba(0, 0, 0, 0.05)", // 1 — subtle
      "0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)", // 2 — low
      "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)", // 3 — medium
      "0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)", // 4 — elevated
      "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)", // 5 — high
      ...Array(19).fill("none"), // 6-24 — flat design, not used
    ] as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "@font-face": {
            fontFamily: "Aptos",
            fontStyle: "normal",
            fontWeight: 400,
          },
          ":root": {
            "--heatmap-hover-ring": isDark ? "#60a5fa" : "#60a5fa",
          },
          body: {
            backgroundColor: isDark ? brand.darkBg : brand.background,
            ...scrollbarHidden,
            overflow: "hidden auto",
            "&::-webkit-scrollbar-track": {
              background: isDark ? brand.darkSurface : brand.secondaryBg,
            },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? brand.secondaryDark : brand.secondaryLighter,
              borderRadius: "3px",
            },
          },
          html: { ...scrollbarHidden },
          "#root": { ...scrollbarHidden },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            boxShadow: "none",
            textTransform: "none",
            fontWeight: 600,
            padding: "8px 16px",
            border: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          contained: {
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            backgroundColor: brand.primary,
            "&:hover": {
              backgroundColor: brand.primaryDark,
            },
          },
          containedSecondary: {
            backgroundColor: brand.secondary,
            "&:hover": {
              backgroundColor: brand.secondaryDark,
            },
          },
          outlined: {
            border: "none",
            backgroundColor: isDark ? brand.darkSurface : brand.secondaryBg,
            color: isDark ? "#EDE8E5" : brand.secondary,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? brand.darkBorder : brand.secondaryLightest,
            },
          },
          outlinedPrimary: {
            border: "none",
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : brand.primaryBg,
            color: isDark ? brand.primaryLight : brand.primaryDark,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? "rgba(255,61,71,0.25)" : brand.primaryLightest,
            },
          },
          outlinedSecondary: {
            border: "none",
            backgroundColor: isDark ? brand.darkSurface : brand.secondaryBg,
            color: isDark ? "#EDE8E5" : brand.secondary,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? brand.darkBorder : brand.secondaryLightest,
            },
          },
          text: {
            color: isDark ? brand.secondaryLighter : brand.secondary,
            "&:hover": {
              backgroundColor: isDark ? brand.darkSurface : brand.background,
            },
          },
          textPrimary: {
            color: brand.primary,
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : brand.primaryBg,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderRadius: brand.borderRadius,
            border: "none",
            backgroundColor: isDark ? brand.darkPaper : brand.white,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderRadius: brand.borderRadius,
            border: "none",
            backgroundColor: isDark ? brand.darkPaper : brand.white,
          },
          elevation0: {
            boxShadow: "none",
          },
          elevation1: {
            boxShadow: "none",
          },
          elevation2: {
            boxShadow: "none",
          },
          elevation3: {
            boxShadow: "none",
          },
          outlined: {
            border: "none",
            boxShadow: "none",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? brand.darkBorder : brand.secondaryBg}`,
            padding: "12px 16px",
          },
          head: {
            fontWeight: 600,
            color: isDark ? "#EDE8E5" : brand.black,
            backgroundColor: isDark ? brand.darkSurface : brand.background,
            borderBottom: `1px solid ${isDark ? "#4A3F38" : brand.secondaryLightest}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": {
              borderBottom: 0,
            },
            "&.Mui-selected": {
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : brand.primaryBg,
              "&:hover": {
                backgroundColor: isDark ? "rgba(255,61,71,0.18)" : brand.primaryLightest,
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            fontWeight: 500,
          },
          outlined: {
            border: "none",
            backgroundColor: isDark ? brand.darkSurface : brand.secondaryBg,
          },
          colorPrimary: {
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : brand.primaryBg,
            color: isDark ? brand.primaryLight : brand.primaryDeep,
          },
          colorSecondary: {
            backgroundColor: isDark ? brand.darkSurface : brand.secondaryBg,
            color: isDark ? brand.secondaryLighter : brand.secondary,
          },
          colorSuccess: {
            backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#DCFCE7",
            color: isDark ? functional.successLight : functional.successDark,
          },
          colorError: {
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : brand.primaryLightest,
            color: isDark ? brand.primaryLight : brand.primaryDeep,
          },
          colorWarning: {
            backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
            color: isDark ? functional.warningLight : functional.warningDark,
          },
          colorInfo: {
            backgroundColor: isDark ? brand.darkSurface : brand.secondaryBg,
            color: isDark ? brand.secondaryLighter : brand.secondary,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            minWidth: 100,
            padding: "12px 16px",
            color: isDark ? brand.secondaryLighter : brand.secondary,
            "&.Mui-selected": {
              color: brand.primary,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            backgroundColor: brand.primary,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? brand.darkBorder : brand.secondaryLightest,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            "&:before": {
              display: "none",
            },
            "&.Mui-expanded": {
              margin: 0,
            },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            padding: "0 16px",
            "&.Mui-expanded": {
              minHeight: 48,
            },
          },
          content: {
            "&.Mui-expanded": {
              margin: "12px 0",
            },
          },
        },
      },
      MuiAccordionDetails: {
        styleOverrides: {
          root: {
            padding: "0 16px 16px",
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            width: "100%",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: brand.borderRadius - 4,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? brand.darkBorder : brand.secondaryLightest,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? brand.secondaryDark : brand.secondaryLight,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: brand.primary,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? brand.darkSurface : brand.black,
            borderRadius: 6,
            fontSize: "0.75rem",
            padding: "8px 12px",
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : brand.primaryBg,
              "&:hover": {
                backgroundColor: isDark ? "rgba(255,61,71,0.18)" : brand.primaryLightest,
              },
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            "&.Mui-checked": {
              color: brand.primary,
              "& + .MuiSwitch-track": {
                backgroundColor: brand.primaryLight,
              },
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: brand.primary,
              color: brand.white,
              "&:hover": {
                backgroundColor: brand.primaryDark,
              },
            },
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          disableEnforceFocus: true,
        },
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? brand.darkPaper : brand.white,
          },
        },
      },
      MuiModal: {
        defaultProps: {
          disableEnforceFocus: true,
        },
      },
    },
  });
};

// Default export for backward compatibility
const theme = createAppTheme("light");
export default theme;
