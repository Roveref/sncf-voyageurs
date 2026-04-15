import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface TimelineCandidate {
  name: string;
  availableFrom: string;
  availableUntil?: string;
  coveragePct: number;
  delayDays?: number;
}

interface TimelineData {
  needStart: string;
  needEnd: string;
  candidates: TimelineCandidate[];
}

interface MiniTimelineProps {
  title: string;
  data: TimelineData;
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

function toDay(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function coverageColor(pct: number): string {
  return pct >= 75 ? "#4caf50" : pct >= 40 ? "#ff9800" : "#f44336";
}

const MiniTimeline = memo(({ title, data, isDark, warm }: MiniTimelineProps) => {
  const needS = toDay(data.needStart);
  const needE = toDay(data.needEnd);
  // Timeline bounds: min of all starts, max of all ends
  const allStarts = [needS, ...data.candidates.map((c) => toDay(c.availableFrom))];
  const allEnds = [needE, ...data.candidates.map((c) => (c.availableUntil ? toDay(c.availableUntil) : needE))];
  const minT = Math.min(...allStarts);
  const maxT = Math.max(...allEnds);
  const rangeT = maxT - minT || 1;

  const toPct = (d: number) => ((d - minT) / rangeT) * 100;

  const needLeft = toPct(needS);
  const needWidth = toPct(needE) - needLeft;

  const formatShort = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  };

  return (
    <Box
      sx={{
        my: 1,
        p: 1.5,
        borderRadius: 2,
        bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${warm.border}`,
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1.5, color: warm.text }}>{title}</Typography>

      {/* Need period */}
      <Box sx={{ mb: 0.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
          <Typography sx={{ fontSize: 10, color: warm.muted, minWidth: 80, textAlign: "right" }}>Need</Typography>
          <Typography sx={{ fontSize: 9.5, color: warm.muted }}>
            {formatShort(data.needStart)} - {formatShort(data.needEnd)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ minWidth: 80 }} />
          <Box
            sx={{
              flex: 1,
              position: "relative",
              height: 10,
              borderRadius: 5,
              bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                left: `${needLeft}%`,
                width: `${needWidth}%`,
                height: "100%",
                borderRadius: 5,
                bgcolor: "#D97757",
                opacity: 0.7,
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Candidates */}
      {data.candidates.map((c, i) => {
        const cStart = toDay(c.availableFrom);
        const cEnd = c.availableUntil ? toDay(c.availableUntil) : needE;
        const cLeft = toPct(cStart);
        const cWidth = toPct(cEnd) - cLeft;
        const color = coverageColor(c.coveragePct);

        return (
          <Box key={i} sx={{ mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
              <Typography sx={{ fontSize: 10, color: warm.text, minWidth: 80, textAlign: "right", fontWeight: 500 }}>
                {c.name}
              </Typography>
              <Typography sx={{ fontSize: 9.5, color }}>
                {c.coveragePct}%{c.delayDays ? ` (+${c.delayDays}j)` : ""}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ minWidth: 80 }} />
              <Box
                sx={{
                  flex: 1,
                  position: "relative",
                  height: 8,
                  borderRadius: 4,
                  bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                }}
              >
                {/* Need period ghost */}
                <Box
                  sx={{
                    position: "absolute",
                    left: `${needLeft}%`,
                    width: `${needWidth}%`,
                    height: "100%",
                    borderRadius: 4,
                    border: `1px dashed ${warm.muted}`,
                    opacity: 0.2,
                  }}
                />
                {/* Candidate availability */}
                <Box
                  sx={{
                    position: "absolute",
                    left: `${cLeft}%`,
                    width: `${cWidth}%`,
                    height: "100%",
                    borderRadius: 4,
                    bgcolor: color,
                    opacity: 0.75,
                    transition: "width 0.5s ease",
                  }}
                />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
});
MiniTimeline.displayName = "MiniTimeline";

export { MiniTimeline };
