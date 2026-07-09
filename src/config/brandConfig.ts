/**
 * Brand Configuration — SINGLE source of truth for all configurable visual values.
 *
 * All other files should import from here instead of hardcoding color hex values.
 * These defaults are used when the app runs without DB data.
 * At hydration time, `applyBrandConfig()` overwrites them with values from var_config.
 */

// ── Brand Palette ──────────────────────────────────────────────────────────────

export const brand = {
  // Primary (SNCF Voyageurs Magenta)
  primary: "#EB0070",
  primaryDark: "#B8005A",
  primaryLight: "#F04093",
  primaryLighter: "#F571B0",
  primaryLightest: "#FAA3CC",
  primaryBg: "#FDD6E8",
  primaryDeep: "#870042",
  primaryDeepest: "#3C001E",
  // Secondary (Anthracite)
  secondary: "#374151",
  secondaryDark: "#1F2937",
  secondaryLight: "#4B5563",
  secondaryLighter: "#6B7280",
  secondaryLightest: "#9CA3AF",
  secondaryBg: "#E5E7EB",
  // Background
  background: "#F8FAFC",
  white: "#FFFFFF",
  black: "#000000",
  // Dark mode
  darkBg: "#0F172A",
  darkPaper: "#1E293B",
  darkSurface: "#263244",
  darkBorder: "#334155",
  // Identity
  fontFamily: 'Avenir, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  logoPath: "/gaif-logo.svg",
  appName: "GAIF Pilot",
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

// ── Segment Colors (repurposed for GAIF — 4 marqueurs d'industrialisation) ────

export const segmentColors: Record<string, string> = {
  // 4 marqueurs d'industrialisation GAIF
  Clients: "#EB0070",
  Agilite: "#0EA5E9",
  JusteBesoin: "#10B981",
  Innovation: "#F59E0B",
  // Legacy segment codes (kept for backward compatibility with existing components)
  LSC: "#EB0070",
  IEM: "#0EA5E9",
  AUTO: "#10B981",
  CRL: "#F59E0B",
  TMT: "#7C3AED",
  UTL: "#06B6D4",
  AMD: "#EC4899",
  CLR: "#6366F1",
  FSI: "#84CC16",
  INS: "#F97316",
  PHS: "#14B8A6",
  HSC: "#A855F7",
  ERT: "#EF4444",
};

// ── Service Line Colors — one per GAIF patrimoine ─────────────────────────────

export const serviceLineColors: Record<string, string> = {
  // Patrimoines GAIF (7)
  Ferroviaire: "#C8102E",
  Immobilier: "#1E4E8C",
  IO: "#00A3A1",
  "Courants Faibles": "#F59E0B",
  "Propriete Intellectuelle": "#7C3AED",
  "Gares Lignes": "#0EA5E9",
  Foncier: "#10B981",
  // Business Units SNCF Voyageurs (3) — miroir de BU_COLOR dans src/data/gaifSites.ts
  Transilien: "#EB0070",
  TER: "#0EA5E9",
  Intercités: "#7C3AED",
  // Legacy service lines (kept to avoid breaking existing components)
  BTU: "#EB0070",
  ETU: "#374151",
  Products: "#C8102E",
  Arcwide: "#1E4E8C",
};

// ── Grade Colors — GAIF niveaux hiérarchiques ─────────────────────────────────

export const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  // GAIF levels
  Directeur: { bg: "#fce7f3", text: "#831843", border: "#f9a8d4" },
  "Responsable pôle": { bg: "#fdf2f8", text: "#9d174d", border: "#f9a8d4" },
  "Adj. pôle": { bg: "#fdf4ff", text: "#86198f", border: "#e9d5ff" },
  "Expert senior": { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd" },
  "Chargé mission senior": { bg: "#f0f9ff", text: "#0c4a6e", border: "#7dd3fc" },
  "Chargé mission": { bg: "#f0fdfa", text: "#134e4a", border: "#5eead4" },
  "Secrétaire technique": { bg: "#f5f3ff", text: "#4c1d95", border: "#c4b5fd" },
  PMO: { bg: "#fffbeb", text: "#78350f", border: "#fcd34d" },
  // Legacy grades (backward compat)
  Partner: { bg: "#fce7f3", text: "#831843", border: "#f9a8d4" },
  Director: { bg: "#fdf2f8", text: "#9d174d", border: "#f9a8d4" },
  "Senior Manager": { bg: "#fdf4ff", text: "#86198f", border: "#e9d5ff" },
  Manager: { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd" },
  "Senior Consultant": { bg: "#f0f9ff", text: "#0c4a6e", border: "#7dd3fc" },
  Consultant: { bg: "#f0fdfa", text: "#134e4a", border: "#5eead4" },
  Analyst: { bg: "#f5f3ff", text: "#4c1d95", border: "#c4b5fd" },
  Intern: { bg: "#fffbeb", text: "#78350f", border: "#fcd34d" },
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

// ── Chart Palette — GAIF patrimoines + accents ─────────────────────────────────

export const chartPalette: string[] = [
  "#EB0070", // primary magenta
  "#C8102E", // ferroviaire
  "#1E4E8C", // immobilier
  "#00A3A1", // IO
  "#F59E0B", // courants faibles
  "#7C3AED", // PI
  "#0EA5E9", // gares/lignes
  "#10B981", // accent green
  "#374151", // anthracite
];

// ── Region Colors — GAIF régions SNCF ──────────────────────────────────────────

export const regionColors: Record<string, { main: string; light: string; dark: string }> = {
  // GAIF regions (entités)
  IDF: { main: "#EB0070", light: "#F571B0", dark: "#B8005A" },
  National: { main: "#374151", light: "#6B7280", dark: "#1F2937" },
  Sud: { main: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
  Est: { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
  Ouest: { main: "#10B981", light: "#34D399", dark: "#059669" },
  Nord: { main: "#7C3AED", light: "#A78BFA", dark: "#6D28D9" },
  // Legacy (backward compat)
  WST: { main: "#EB0070", light: "#F571B0", dark: "#B8005A" },
  EMEA: { main: "#EB0070", light: "#F571B0", dark: "#B8005A" },
  Europe: { main: "#EB0070", light: "#F571B0", dark: "#B8005A" },
  NRT: { main: "#374151", light: "#6B7280", dark: "#1F2937" },
  "North America": { main: "#374151", light: "#6B7280", dark: "#1F2937" },
  Americas: { main: "#374151", light: "#6B7280", dark: "#1F2937" },
  CER: { main: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
  "South America": { main: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
  "Latin America": { main: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
  CSH: { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
  APAC: { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
  "Asia Pacific": { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
  Asia: { main: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
  MEA: { main: "#10B981", light: "#34D399", dark: "#059669" },
  "Middle East": { main: "#10B981", light: "#34D399", dark: "#059669" },
  "Middle East & Africa": { main: "#10B981", light: "#34D399", dark: "#059669" },
  Africa: { main: "#10B981", light: "#34D399", dark: "#059669" },
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
    name: "GAIF Pilot",
    fabIcon: "/gaif-logo.svg",
    fabIconFilter: "brightness(0) invert(1)",
    fabBg: "#EB0070",
    fabHoverBg: "#B8005A",
    fabShadow: "0 4px 20px rgba(235,0,112,0.4)",
    headerBg: "#870042",
    headerIcon: "/gaif-logo.svg",
    headerIconSize: 28,
    headerIconFilter: undefined,
    headerIconOpacity: 0.18,
    thinking: "Analyse en cours",
    icon: "/gaif-logo.svg",
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
