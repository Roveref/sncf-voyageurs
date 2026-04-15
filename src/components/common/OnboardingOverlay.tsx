/**
 * OnboardingOverlay — First-visit guided tour with spotlight-style highlights.
 *
 * Shows 5 sequential tooltip-like steps pointing at key UI elements.
 * Non-blocking: user can still interact with the app behind the overlay.
 * Persists completion via localStorage('onboardingComplete').
 */

import { memo, useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Fade from "@mui/material/Fade";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface OnboardingStep {
  targetAttr: string;
  message: string;
  placement: "bottom" | "right" | "left" | "top";
}

const STEPS: OnboardingStep[] = [
  {
    targetAttr: "tabs",
    message: "Switch between Pipeline, Staffing, and Project views",
    placement: "bottom",
  },
  {
    targetAttr: "sidebar",
    message: "Filter by segment or service line",
    placement: "right",
  },
  {
    targetAttr: "heatmap",
    message: "Colors show each employee's utilization",
    placement: "top",
  },
  {
    targetAttr: "fab",
    message: "Create opportunities, accounts, or staffing needs",
    placement: "top",
  },
  {
    targetAttr: "chat",
    message: "Ask the AI assistant about your data",
    placement: "top",
  },
];

interface TooltipPosition {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
}

function getTooltipPosition(rect: DOMRect, placement: OnboardingStep["placement"]): TooltipPosition {
  const gap = 12;
  switch (placement) {
    case "bottom":
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: "translateX(-50%)",
      };
    case "top":
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: "translateY(-50%)",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
      };
  }
}

const STORAGE_KEY = "onboardingComplete";

const OnboardingOverlay = memo(() => {
  const [step, setStep] = useState<number>(() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) return 0;
    return 1; // start at first step
  });

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Check if already completed on mount
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setStep(0);
    }
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    setTimeout(() => setStep(0), 300);
  }, []);

  const advance = useCallback(() => {
    if (step >= STEPS.length) {
      complete();
      return;
    }
    setStep((s) => s + 1);
  }, [step, complete]);

  // Locate target element and update position
  useEffect(() => {
    if (step === 0 || step > STEPS.length) {
      setVisible(false);
      return;
    }
    const currentStep = STEPS[step - 1];
    const updatePosition = () => {
      const el = document.querySelector(`[data-onboarding="${currentStep.targetAttr}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        setVisible(true);
      } else {
        // Element not found yet — retry
        setVisible(false);
      }
    };

    // Initial measurement with small delay to let layout settle
    const t = setTimeout(updatePosition, 300);

    // Keep position updated on resize/scroll
    const handleResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePosition);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("scroll", handleResize, { passive: true });

    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [step]);

  if (step === 0 || step > STEPS.length) return null;

  const currentStep = STEPS[step - 1];
  const tooltipPos = targetRect ? getTooltipPosition(targetRect, currentStep.placement) : null;

  return (
    <>
      {/* Spotlight: semi-transparent backdrop with a hole cut out around the target */}
      {targetRect && visible && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 19998,
            pointerEvents: "none",
          }}
        >
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="onboarding-spotlight-mask">
                {/* White = show backdrop */}
                <rect width="100%" height="100%" fill="white" />
                {/* Black = transparent hole (the spotlight) */}
                <rect
                  x={Math.max(0, targetRect.left - 6)}
                  y={Math.max(0, targetRect.top - 6)}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.45)" mask="url(#onboarding-spotlight-mask)" />
          </svg>

          {/* Highlight border around the target */}
          <Box
            sx={{
              position: "absolute",
              left: Math.max(0, targetRect.left - 6),
              top: Math.max(0, targetRect.top - 6),
              width: targetRect.width + 12,
              height: targetRect.height + 12,
              borderRadius: "8px",
              border: "2px solid rgba(255, 255, 255, 0.7)",
              boxShadow: "0 0 0 2px rgba(255, 61, 71, 0.4)",
              transition: "all 0.3s ease",
            }}
          />
        </Box>
      )}

      {/* Tooltip card */}
      <Fade in={visible} timeout={250}>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            zIndex: 19999,
            maxWidth: 280,
            minWidth: 200,
            p: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)",
            pointerEvents: "auto",
            ...(tooltipPos || { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
          }}
        >
          {/* Step indicator */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
            {STEPS.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: i === step - 1 ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: i === step - 1 ? "#CC2931" : "grey.300",
                  transition: "width 0.2s ease, background-color 0.2s ease",
                }}
              />
            ))}
          </Box>

          <Typography
            variant="body2"
            sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary", mb: 1.5, lineHeight: 1.4 }}
          >
            {currentStep.message}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Button
              size="small"
              variant="text"
              onClick={complete}
              sx={{ fontSize: "0.75rem", color: "text.secondary", textTransform: "none", p: 0, minWidth: "auto" }}
            >
              Skip tour
            </Button>

            <Button
              size="small"
              variant="contained"
              onClick={advance}
              endIcon={step < STEPS.length ? <ArrowForwardIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                fontSize: "0.8rem",
                textTransform: "none",
                bgcolor: "#CC2931",
                "&:hover": { bgcolor: "#b01f26" },
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
              }}
            >
              {step < STEPS.length ? "Next" : "Done"}
            </Button>
          </Box>
        </Paper>
      </Fade>
    </>
  );
});

OnboardingOverlay.displayName = "OnboardingOverlay";
export default OnboardingOverlay;
