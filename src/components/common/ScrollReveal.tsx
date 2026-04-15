import React, { memo } from "react";
import Box from "@mui/material/Box";
import { useInView } from "../../hooks/useInView";
import { keyframes } from "../../styles/animations";

/**
 * Wraps children in a fade-in-up animation triggered when the element scrolls into view.
 * Uses IntersectionObserver (once: true) — zero JS cost after first trigger.
 */
const ScrollReveal = memo(({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.05 });

  return (
    <Box
      ref={ref}
      sx={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms, transform 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms`,
        willChange: inView ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </Box>
  );
});

ScrollReveal.displayName = "ScrollReveal";

export default ScrollReveal;
