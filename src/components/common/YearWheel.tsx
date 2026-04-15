import React, { useRef, useCallback, useEffect, memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { brand } from "../../config/brandConfig";

interface YearWheelProps {
  startYear?: number;
  endYear?: number;
  selectedYear: number | null;
  onSelect: (year: number | null) => void;
  darkMode?: boolean;
}

const ITEM_WIDTH = 80;
const SCROLL_SPEED = 2;

const YearWheel = memo(
  ({ startYear = 2015, endYear = 2026, selectedYear, onSelect, darkMode = false }: YearWheelProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const hoverZone = useRef<"left" | "right" | null>(null);
    const rafRef = useRef<number>(0);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragScrollLeft = useRef(0);
    const selectedRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const years: (number | "All")[] = [
      "All",
      ...Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i),
    ];

    // ── Auto-scroll on hover edges ──
    const tick = useCallback(() => {
      const el = scrollRef.current;
      if (!el || !hoverZone.current) return;
      el.scrollLeft += (hoverZone.current === "left" ? -1 : 1) * SCROLL_SPEED;
      rafRef.current = requestAnimationFrame(tick);
    }, []);

    const startScroll = useCallback(
      (zone: "left" | "right") => {
        hoverZone.current = zone;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      },
      [tick]
    );

    const stopScroll = useCallback(() => {
      hoverZone.current = null;
      cancelAnimationFrame(rafRef.current);
    }, []);

    // ── Drag to scroll ──
    const onPointerDown = useCallback((e: React.PointerEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragScrollLeft.current = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDragging.current || !scrollRef.current) return;
      scrollRef.current.scrollLeft = dragScrollLeft.current - (e.clientX - dragStartX.current);
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
      isDragging.current = false;
      if (scrollRef.current) {
        scrollRef.current.releasePointerCapture(e.pointerId);
        scrollRef.current.style.cursor = "grab";
      }
    }, []);

    // ── Keyboard arrows ──
    // Global keyboard listener — arrows always work regardless of focus
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        // Don't capture if user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        const idx = selectedYear === null ? 0 : years.indexOf(selectedYear);
        const nextIdx = e.key === "ArrowLeft" ? Math.max(0, idx - 1) : Math.min(years.length - 1, idx + 1);
        const next = years[nextIdx];
        onSelect(next === "All" ? null : (next as number));
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [selectedYear, years, onSelect]);

    // Smooth scroll animation with custom easing
    const animRef = useRef<number>(0);
    const smoothScrollTo = useCallback((el: HTMLElement, target: number, duration: number) => {
      cancelAnimationFrame(animRef.current);
      const start = el.scrollLeft;
      const delta = target - start;
      if (Math.abs(delta) < 1) return;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        // ease-out cubic
        const ease = 1 - Math.pow(1 - p, 3);
        el.scrollLeft = start + delta * ease;
        if (p < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }, []);

    // Center on selected year — smooth after mount, instant on mount
    const mountedRef = useRef(false);
    useEffect(() => {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        const item = selectedRef.current;
        if (!el || !item) return;
        const target = item.offsetLeft - el.clientWidth / 2 + item.offsetWidth / 2;
        if (mountedRef.current) {
          smoothScrollTo(el, target, 350);
        } else {
          el.scrollLeft = target;
        }
        mountedRef.current = true;
      });
    }, [selectedYear, smoothScrollTo]);

    useEffect(
      () => () => {
        cancelAnimationFrame(rafRef.current);
        cancelAnimationFrame(animRef.current);
      },
      []
    );

    return (
      <Box ref={wrapperRef} sx={{ position: "relative", width: "100%", maxWidth: 440, mx: "auto", userSelect: "none" }}>
        {/* Invisible hover zones for auto-scroll — no background, no overlay */}
        <Box
          onMouseEnter={() => startScroll("left")}
          onMouseLeave={stopScroll}
          sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 70, zIndex: 2, cursor: "w-resize" }}
        />
        <Box
          onMouseEnter={() => startScroll("right")}
          onMouseLeave={stopScroll}
          sx={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 70, zIndex: 2, cursor: "e-resize" }}
        />

        {/* Scrollable track */}
        <Box
          ref={scrollRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            display: "flex",
            alignItems: "center",
            overflowX: "auto",
            px: "calc(50% - 40px)",
            py: 1.5,
            cursor: "grab",
            maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {years.map((year) => {
            const isSelected = year === "All" ? selectedYear === null : year === selectedYear;
            return (
              <Box
                key={year}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => {
                  if (!isDragging.current) onSelect(year === "All" ? null : (year as number));
                }}
                sx={{
                  flex: "0 0 auto",
                  width: ITEM_WIDTH,
                  height: 48,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  borderRadius: 2,
                  "&:hover .year-base": {
                    opacity: isSelected ? "0 !important" : "0.7 !important",
                  },
                }}
              >
                {/* Two overlapping texts: bold (red) fades in, regular fades out */}
                <Box
                  sx={{
                    position: "relative",
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Base text — always present, fades out when selected */}
                  <Typography
                    className="year-base"
                    sx={{
                      fontWeight: 400,
                      fontSize: "1.05rem",
                      color: "text.secondary",
                      opacity: isSelected ? 0 : 0.4,
                      transition: "opacity 0.4s cubic-bezier(0.23,1,0.32,1)",
                      position: "absolute",
                    }}
                  >
                    {year}
                  </Typography>
                  {/* Bold text — fades in + scales up when selected */}
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      color: brand.primary,
                      opacity: isSelected ? 1 : 0,
                      transform: isSelected ? "scale(1.18)" : "scale(0.95)",
                      transition:
                        "opacity 0.4s cubic-bezier(0.23,1,0.32,1), transform 0.4s cubic-bezier(0.23,1,0.32,1)",
                      position: "absolute",
                    }}
                  >
                    {year}
                  </Typography>
                </Box>
                {isSelected && (
                  <Box
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: brand.primary,
                      mt: 0.5,
                      boxShadow: "0 0 8px rgba(255,61,71,0.5)",
                      animation: "pulseGlow 2s ease-in-out infinite",
                      "@keyframes pulseGlow": {
                        "0%, 100%": { boxShadow: "0 0 6px rgba(255,61,71,0.4)" },
                        "50%": { boxShadow: "0 0 14px rgba(255,61,71,0.7)" },
                      },
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }
);
YearWheel.displayName = "YearWheel";

export default YearWheel;
