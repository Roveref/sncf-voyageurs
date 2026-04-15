/**
 * Per-jobcode hash-based color palette.
 *
 * Mirrors the visual intent of staffing's `getGroupColors()` (utils/groupingUtils.ts),
 * which assigns a stable color to each grouped entity. Since jobcodes have no
 * inherent palette, we hash the jobcode string to pick a hue deterministically.
 *
 * Returns `bg` (10% alpha-equivalent), `text` (dark for fg use), and `border`
 * (medium saturation for the indent left-border on grouped children).
 */
export interface JobcodeGroupColors {
  bg: string;
  text: string;
  border: string;
}

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

export const getJobcodeGroupColors = (jobcode: string): JobcodeGroupColors => {
  if (!jobcode) {
    return { bg: "#f3f4f6", text: "#374151", border: "#cbd5e1" };
  }
  const hue = hashString(jobcode) % 360;
  return {
    bg: `hsl(${hue}, 60%, 96%)`,
    text: `hsl(${hue}, 55%, 28%)`,
    border: `hsl(${hue}, 50%, 65%)`,
  };
};
