import { createTheme } from "@mui/material/styles";

// BearingPoint Brand Colors
const bearingPointColors = {
  // Red family
  R80: "#330000", // Deep Red
  R70: "#99171D",
  R60: "#CC2931",
  R50: "#FF3D47", // Bearing Red (Primary)
  R40: "#FF787A",
  R30: "#FFA3A8",
  R20: "#FFBDC0",
  R10: "#FFD6D8",
  // Grey family
  G60: "#806659",
  G50: "#98847A",
  G40: "#B2A59F",
  G30: "#CCC1BC",
  G20: "#E6DEDA",
  G10: "#FAF8F7",
  // Black & White
  black: "#000000",
  white: "#FFFFFF",
};

// Dark mode background/surface colors (warm-toned to match BearingPoint brand)
const darkColors = {
  bg: "#1A1210",
  paper: "#241E1B",
  surface: "#2E2622",
  border: "#3D3129",
};

export const createAppTheme = (mode = "light") => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: bearingPointColors.R50,
        light: bearingPointColors.R40,
        dark: bearingPointColors.R60,
        contrastText: bearingPointColors.white,
      },
      secondary: {
        main: bearingPointColors.G60,
        light: bearingPointColors.G50,
        dark: "#5C4A3F",
        contrastText: bearingPointColors.white,
      },
      error: {
        main: bearingPointColors.R60,
        light: bearingPointColors.R40,
        dark: bearingPointColors.R70,
      },
      warning: {
        main: "#F59E0B",
        light: "#FBBF24",
        dark: "#D97706",
      },
      info: {
        main: isDark ? bearingPointColors.G40 : bearingPointColors.G50,
        light: bearingPointColors.G40,
        dark: bearingPointColors.G60,
      },
      success: {
        main: "#10B981",
        light: "#34D399",
        dark: "#059669",
      },
      grey: {
        50: isDark ? darkColors.surface : bearingPointColors.G10,
        100: isDark ? darkColors.border : bearingPointColors.G20,
        200: isDark ? "#4A3F38" : bearingPointColors.G30,
        300: isDark ? "#5C4A3F" : bearingPointColors.G40,
        400: isDark ? bearingPointColors.G50 : bearingPointColors.G50,
        500: bearingPointColors.G60,
        600: "#6B5A4E",
        700: "#5C4A3F",
        800: "#3D3129",
        900: "#1F1915",
      },
      background: {
        default: isDark ? darkColors.bg : bearingPointColors.G10,
        paper: isDark ? darkColors.paper : bearingPointColors.white,
      },
      text: {
        primary: isDark ? "#EDE8E5" : bearingPointColors.black,
        secondary: isDark ? bearingPointColors.G40 : bearingPointColors.G60,
        disabled: isDark ? "#5C4A3F" : bearingPointColors.G40,
      },
      divider: isDark ? darkColors.border : bearingPointColors.G30,
    },
    typography: {
      fontFamily: 'Aptos, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
      borderRadius: 8,
    },
    shadows: [
      "none",
      "0px 1px 2px rgba(0, 0, 0, 0.05)",
      "0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)",
      "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)",
      "0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)",
      "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
      "0px 25px 50px -12px rgba(0, 0, 0, 0.25)",
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "@font-face": {
            fontFamily: "Aptos",
            fontStyle: "normal",
            fontWeight: 400,
          },
          body: {
            backgroundColor: isDark ? darkColors.bg : bearingPointColors.G10,
            scrollbarWidth: "none",
            overflow: "hidden auto",
            "&::-webkit-scrollbar": {
              width: "0",
              height: "0.4rem",
            },
            "&::-webkit-scrollbar-track": {
              background: isDark ? darkColors.surface : bearingPointColors.G20,
            },
            "&::-webkit-scrollbar-thumb": {
              background: isDark ? "#5C4A3F" : bearingPointColors.G40,
              borderRadius: "3px",
            },
          },
          html: {
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": {
              width: "0",
              height: "0.4rem",
            },
          },
          "#root": {
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": {
              width: "0",
              height: "0.4rem",
            },
          },
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
            backgroundColor: bearingPointColors.R50,
            "&:hover": {
              backgroundColor: bearingPointColors.R60,
            },
          },
          containedSecondary: {
            backgroundColor: bearingPointColors.G60,
            "&:hover": {
              backgroundColor: "#5C4A3F",
            },
          },
          outlined: {
            border: "none",
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.G20,
            color: isDark ? "#EDE8E5" : bearingPointColors.G60,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? darkColors.border : bearingPointColors.G30,
            },
          },
          outlinedPrimary: {
            border: "none",
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : bearingPointColors.R10,
            color: isDark ? bearingPointColors.R40 : bearingPointColors.R60,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? "rgba(255,61,71,0.25)" : bearingPointColors.R20,
            },
          },
          outlinedSecondary: {
            border: "none",
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.G20,
            color: isDark ? "#EDE8E5" : bearingPointColors.G60,
            "&:hover": {
              border: "none",
              backgroundColor: isDark ? darkColors.border : bearingPointColors.G30,
            },
          },
          text: {
            color: isDark ? bearingPointColors.G40 : bearingPointColors.G60,
            "&:hover": {
              backgroundColor: isDark ? darkColors.surface : bearingPointColors.G10,
            },
          },
          textPrimary: {
            color: bearingPointColors.R50,
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : bearingPointColors.R10,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderRadius: 12,
            border: "none",
            backgroundColor: isDark ? darkColors.paper : bearingPointColors.white,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderRadius: 12,
            border: "none",
            backgroundColor: isDark ? darkColors.paper : bearingPointColors.white,
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
            borderBottom: `1px solid ${isDark ? darkColors.border : bearingPointColors.G20}`,
            padding: "12px 16px",
          },
          head: {
            fontWeight: 600,
            color: isDark ? "#EDE8E5" : bearingPointColors.black,
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.G10,
            borderBottom: `1px solid ${isDark ? "#4A3F38" : bearingPointColors.G30}`,
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
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : bearingPointColors.R10,
              "&:hover": {
                backgroundColor: isDark ? "rgba(255,61,71,0.18)" : bearingPointColors.R20,
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
          colorPrimary: {
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : bearingPointColors.R10,
            color: isDark ? bearingPointColors.R40 : bearingPointColors.R70,
          },
          colorSecondary: {
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.G20,
            color: isDark ? bearingPointColors.G40 : bearingPointColors.G60,
          },
          colorSuccess: {
            backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#DCFCE7",
            color: isDark ? "#34D399" : "#059669",
          },
          colorError: {
            backgroundColor: isDark ? "rgba(255,61,71,0.15)" : bearingPointColors.R20,
            color: isDark ? bearingPointColors.R40 : bearingPointColors.R70,
          },
          colorWarning: {
            backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
            color: isDark ? "#FBBF24" : "#D97706",
          },
          colorInfo: {
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.G20,
            color: isDark ? bearingPointColors.G40 : bearingPointColors.G60,
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
            color: isDark ? bearingPointColors.G40 : bearingPointColors.G60,
            "&.Mui-selected": {
              color: bearingPointColors.R50,
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
            backgroundColor: bearingPointColors.R50,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? darkColors.border : bearingPointColors.G30,
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
            borderRadius: 8,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? darkColors.border : bearingPointColors.G30,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "#5C4A3F" : bearingPointColors.G50,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: bearingPointColors.R50,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? darkColors.surface : bearingPointColors.black,
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
              backgroundColor: isDark ? "rgba(255,61,71,0.12)" : bearingPointColors.R10,
              "&:hover": {
                backgroundColor: isDark ? "rgba(255,61,71,0.18)" : bearingPointColors.R20,
              },
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            "&.Mui-checked": {
              color: bearingPointColors.R50,
              "& + .MuiSwitch-track": {
                backgroundColor: bearingPointColors.R40,
              },
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: bearingPointColors.R50,
              color: bearingPointColors.white,
              "&:hover": {
                backgroundColor: bearingPointColors.R60,
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? darkColors.paper : bearingPointColors.white,
          },
        },
      },
    },
  });
};

// Default export for backward compatibility
const theme = createAppTheme("light");
export default theme;
