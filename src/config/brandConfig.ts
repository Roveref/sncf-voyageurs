/**
 * Brand Configuration — SINGLE source of truth for all configurable visual values.
 *
 * All other files should import from here instead of hardcoding color hex values.
 * These defaults are used when the app runs without DB data.
 * At hydration time, `applyBrandConfig()` overwrites them with values from var_config.
 */

// ── Brand Palette ──────────────────────────────────────────────────────────────

export const brand = {
  // Primary (BearingPoint Red)
  primary: "#FF3D47",
  primaryDark: "#CC2931",
  primaryLight: "#FF787A",
  primaryLighter: "#FFA3A8",
  primaryLightest: "#FFBDC0",
  primaryBg: "#FFD6D8",
  primaryDeep: "#99171D",
  primaryDeepest: "#330000",
  // Secondary (Warm Grey)
  secondary: "#806659",
  secondaryDark: "#5C4A3F",
  secondaryLight: "#98847A",
  secondaryLighter: "#B2A59F",
  secondaryLightest: "#CCC1BC",
  secondaryBg: "#E6DEDA",
  // Background
  background: "#FAF8F7",
  white: "#FFFFFF",
  black: "#000000",
  // Dark mode
  darkBg: "#1A1210",
  darkPaper: "#241E1B",
  darkSurface: "#2E2622",
  darkBorder: "#3D3129",
  // Identity
  fontFamily: 'Aptos, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  logoPath: "/Beonpoint_stars.svg",
  appName: "Be.on\u00B0",
  borderRadius: 12,
};

// ── Functional Colors (not brand-specific but configurable) ────────────────────

export const functional = {
  success: "#10B981",
  successLight: "#34D399",
  successDark: "#059669",
  warning: "#F59E0B",
  warningLight: "#FBBF24",
  warningDark: "#D97706",
  info: "#3b82f6",
};

// ── Segment Colors ─────────────────────────────────────────────────────────────

export const segmentColors: Record<string, string> = {
  LSC: "#FF3D47",
  IEM: "#CC2931",
  AUTO: "#99171D",
  CRL: "#FF787A",
  TMT: "#806659",
  UTL: "#98847A",
  AMD: "#FF3D47",
  CLR: "#B2A59F",
  FSI: "#CC2931",
  INS: "#CCC1BC",
  PHS: "#99171D",
  HSC: "#5C4A3F",
  ERT: "#FFA3A8",
};

// ── Service Line Colors ────────────────────────────────────────────────────────

export const serviceLineColors: Record<string, string> = {
  BTU: "#FF3D47",
  ETU: "#806659",
  Products: "#CC2931",
  Arcwide: "#98847A",
};

// ── Grade Colors ───────────────────────────────────────────────────────────────

export const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  Partner: { bg: "#ede5e0", text: "#4a3728", border: "#a8917e" },
  Director: { bg: "#f0e9e4", text: "#5C4A3F", border: "#b09a8a" },
  "Senior Manager": { bg: "#f2edeb", text: "#6b554a", border: "#b8a89e" },
  Manager: { bg: "#f7f2ee", text: "#806659", border: "#cdbdaf" },
  "Senior Consultant": { bg: "#ecedef", text: "#4a4e54", border: "#a8abb2" },
  Consultant: { bg: "#eff0f2", text: "#5a5e64", border: "#b4b8be" },
  Analyst: { bg: "#f5f5f6", text: "#7a7e84", border: "#cccfd4" },
  Intern: { bg: "#f7f8f8", text: "#8a8e94", border: "#d8dade" },
};

// Category colors now applied by applyCategoryConfig() from var_config.category

// ── Utilization Colors ─────────────────────────────────────────────────────────

export const utilizationColors: Record<string, { bg: string; text: string; bar: string; dot: string }> = {
  available: { bg: "#f3f4f6", text: "#4b5563", bar: "#d1d5db", dot: "#9ca3af" },
  low: { bg: "#f0f9ff", text: "#0369a1", bar: "#38bdf8", dot: "#38bdf8" },
  partial: { bg: "#eff6ff", text: "#1d4ed8", bar: "#3b82f6", dot: "#3b82f6" },
  optimal: { bg: "#ecfdf5", text: "#047857", bar: "#10b981", dot: "#10b981" },
  overbooked: { bg: "#fef2f2", text: "#b91c1c", bar: "#ef4444", dot: "#ef4444" },
};

// ── Main Category Colors ───────────────────────────────────────────────────────

export const mainCatColors: Record<string, string> = {
  absence: "#ef4444",
  chargeable: "#3b82f6",
  training: "#10b981",
  reservation: "#f59e0b",
  nonChargeable: "#6b7280",
};

// ── Macro Grade Colors ─────────────────────────────────────────────────────────

export const macroGradeColors: Record<string, string> = {
  "M+": "#1e40af",
  "M-": "#7c3aed",
};

// ── Chart Palette ──────────────────────────────────────────────────────────────

export const chartPalette: string[] = [
  "#FF3D47",
  "#806659",
  "#CC2931",
  "#98847A",
  "#99171D",
  "#B2A59F",
  "#FF787A",
  "#330000",
  "#CCC1BC",
];

// ── Region Colors ──────────────────────────────────────────────────────────────

export const regionColors: Record<string, { main: string; light: string; dark: string }> = {
  WST: { main: "#FF3D47", light: "#FF787A", dark: "#CC2931" },
  EMEA: { main: "#FF3D47", light: "#FF787A", dark: "#CC2931" },
  Europe: { main: "#FF3D47", light: "#FF787A", dark: "#CC2931" },
  NRT: { main: "#98847A", light: "#B2A59F", dark: "#806659" },
  "North America": { main: "#98847A", light: "#B2A59F", dark: "#806659" },
  Americas: { main: "#98847A", light: "#B2A59F", dark: "#806659" },
  CER: { main: "#99171D", light: "#CC2931", dark: "#330000" },
  "South America": { main: "#99171D", light: "#CC2931", dark: "#330000" },
  "Latin America": { main: "#99171D", light: "#CC2931", dark: "#330000" },
  CSH: { main: "#FFA3A8", light: "#FFBDC0", dark: "#FF787A" },
  APAC: { main: "#FFA3A8", light: "#FFBDC0", dark: "#FF787A" },
  "Asia Pacific": { main: "#FFA3A8", light: "#FFBDC0", dark: "#FF787A" },
  Asia: { main: "#FFA3A8", light: "#FFBDC0", dark: "#FF787A" },
  MEA: { main: "#B2A59F", light: "#CCC1BC", dark: "#806659" },
  "Middle East": { main: "#B2A59F", light: "#CCC1BC", dark: "#806659" },
  "Middle East & Africa": { main: "#B2A59F", light: "#CCC1BC", dark: "#806659" },
  Africa: { main: "#B2A59F", light: "#CCC1BC", dark: "#806659" },
};

// ── Chat Provider Branding ─────────────────────────────────────────────────────

export const chatBranding: Record<
  string,
  {
    name: string;
    fabIcon: string;
    fabIconFilter: string;
    fabBg: string;
    fabHoverBg: string;
    fabShadow: string;
    headerBg: string;
    headerIcon: string;
    headerIconSize: number;
    headerIconFilter?: string;
    headerIconOpacity: number;
    thinking: string;
    icon: string;
  }
> = {
  ollama: {
    name: "Be.on\u00B0",
    fabIcon: "/Beonpoint_stars.svg",
    fabIconFilter: "brightness(0) invert(1)",
    fabBg: "#98847A",
    fabHoverBg: "#806659",
    fabShadow: "0 4px 20px rgba(128,102,89,0.4)",
    headerBg: "#330000",
    headerIcon: "/Beonpoint_stars.svg",
    headerIconSize: 28,
    headerIconFilter: undefined,
    headerIconOpacity: 0.15,
    thinking: "Thinking",
    icon: "/Beonpoint_stars.svg",
  },
  claude: {
    name: "Claude",
    fabIcon: "/claude_logo.png",
    fabIconFilter: "brightness(0) invert(1)",
    fabBg: "#D97757",
    fabHoverBg: "#C4673F",
    fabShadow: "0 4px 20px rgba(217,119,87,0.4)",
    headerBg: "#D97757",
    headerIcon: "/claude_logo.png",
    headerIconSize: 48,
    headerIconFilter: undefined,
    headerIconOpacity: 0.08,
    thinking: "Thinking",
    icon: "/claude_logo.png",
  },
};

// ── Brand change notification ─────────────────────────────────────────────────
// Allows consumers (e.g. App.tsx ThemeProvider) to react when applyBrandConfig mutates the brand object.

let _onBrandChange: (() => void) | null = null;
export function onBrandConfigChange(cb: () => void) {
  _onBrandChange = cb;
}

// ── applyBrandConfig ───────────────────────────────────────────────────────────
// Called from useHydration with the grouped var_config data.
// Reads consolidated JSON entries: brand.colors, brand.identity, theme.chart, etc.

export function applyBrandConfig(config: Record<string, Record<string, string>>): number {
  let count = 0;

  /** Safely parse a JSON string or return the value if already an object. */
  const parseJson = (raw: unknown): unknown => {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  };

  // ── brand category (consolidated JSON: "colors" + "identity") ──
  if (config.brand) {
    // New format: brand.colors is a JSON string with all color keys
    const colorsRaw = config.brand.colors;
    if (colorsRaw) {
      const colors = parseJson(colorsRaw) as Record<string, string> | null;
      if (colors) {
        // Brand palette + dark mode colors
        for (const [key, value] of Object.entries(colors)) {
          if (key in brand) {
            (brand as Record<string, unknown>)[key] = value;
            count++;
          } else if (key in functional) {
            (functional as Record<string, string>)[key] = value;
            count++;
          }
        }
      }
    }

    // New format: brand.identity is a JSON string with font/logo/name/radius
    const identityRaw = config.brand.identity;
    if (identityRaw) {
      const identity = parseJson(identityRaw) as Record<string, string> | null;
      if (identity) {
        for (const [key, value] of Object.entries(identity)) {
          if (key in brand) {
            (brand as Record<string, unknown>)[key] = key === "borderRadius" ? Number(value) : value;
            count++;
          }
        }
      }
    }
  }

  // ── theme category (consolidated JSON entries) ──
  if (config.theme) {
    // chart — JSON array of hex colors
    const chartRaw = config.theme.chart;
    if (chartRaw) {
      const arr = parseJson(chartRaw) as string[] | null;
      if (Array.isArray(arr)) {
        chartPalette.length = 0;
        chartPalette.push(...arr);
        count += arr.length;
      }
    }

    // macroGrade — JSON Record<"M+"|"M-", hex>
    const macroRaw = config.theme.macroGrade;
    if (macroRaw) {
      const obj = parseJson(macroRaw) as Record<string, string> | null;
      if (obj) {
        for (const [key, value] of Object.entries(obj)) {
          macroGradeColors[key] = value;
          count++;
        }
      }
    }

    // mainCategory — JSON Record<cat, hex>
    const mainCatRaw = config.theme.mainCategory;
    if (mainCatRaw) {
      const obj = parseJson(mainCatRaw) as Record<string, string> | null;
      if (obj) {
        for (const [key, value] of Object.entries(obj)) {
          mainCatColors[key] = value;
          count++;
        }
      }
    }

    // region — JSON Record<code, {main, light, dark}>
    const regionRaw = config.theme.region;
    if (regionRaw) {
      const obj = parseJson(regionRaw) as Record<string, { main: string; light: string; dark: string }> | null;
      if (obj) {
        for (const [region, colors] of Object.entries(obj)) {
          regionColors[region] = { ...colors };
          count++;
        }
      }
    }

    // segment — JSON Record<code, hex>
    const segmentRaw = config.theme.segment;
    if (segmentRaw) {
      const obj = parseJson(segmentRaw) as Record<string, string> | null;
      if (obj) {
        for (const [key, value] of Object.entries(obj)) {
          segmentColors[key] = value;
          count++;
        }
      }
    }

    // serviceLine — JSON Record<name, hex>
    const slRaw = config.theme.serviceLine;
    if (slRaw) {
      const obj = parseJson(slRaw) as Record<string, string> | null;
      if (obj) {
        for (const [key, value] of Object.entries(obj)) {
          serviceLineColors[key] = value;
          count++;
        }
      }
    }

    // utilization — JSON Record<level, {bg, text, bar, dot}>
    const utilRaw = config.theme.utilization;
    if (utilRaw) {
      const obj = parseJson(utilRaw) as Record<string, { bg: string; text: string; bar: string; dot: string }> | null;
      if (obj) {
        for (const [level, colors] of Object.entries(obj)) {
          utilizationColors[level] = { ...colors };
          count++;
        }
      }
    }
  }

  // Grade colors now applied by applyGradeConfig() from var_config.grade.*.bg/text/border
  // Category colors now applied by applyCategoryConfig() from var_config.category

  // chatBranding — flattened: "ollama_fabBg", "claude_headerBg" etc. (unchanged)
  if (config.chatBranding) {
    for (const [flatKey, value] of Object.entries(config.chatBranding)) {
      const firstUnderscore = flatKey.indexOf("_");
      if (firstUnderscore === -1) continue;
      const provider = flatKey.substring(0, firstUnderscore);
      const prop = flatKey.substring(firstUnderscore + 1);
      if (!chatBranding[provider]) {
        chatBranding[provider] = {
          name: provider,
          fabIcon: "",
          fabIconFilter: "none",
          fabBg: "#999999",
          fabHoverBg: "#666666",
          fabShadow: "none",
          headerBg: "#333333",
          headerIcon: "",
          headerIconSize: 28,
          headerIconFilter: undefined,
          headerIconOpacity: 0.15,
          thinking: "Thinking",
          icon: "",
        };
      }
      if (prop in chatBranding[provider]) {
        (chatBranding[provider] as Record<string, unknown>)[prop] =
          prop === "headerIconSize" || prop === "headerIconOpacity" ? Number(value) : value;
        count++;
      }
    }
  }

  // Notify listeners that brand values changed so MUI theme can rebuild
  _onBrandChange?.();

  return count;
}
