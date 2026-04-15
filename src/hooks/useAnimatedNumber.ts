import { useEffect, useRef, useState } from "react";

/** EaseOutQuart — approximates cubic-bezier(0.23, 1, 0.32, 1) */
function cubicBezierEase(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Animates a number from 0 (or previous value) to the target.
 * On mount: animates from 0 → target with a small random stagger delay
 * to avoid a burst of 50+ simultaneous animations killing the main thread.
 * On value change: animates from previous → target immediately.
 * Respects prefers-reduced-motion.
 */
export function useAnimatedNumber(target: number, duration: number = 800, decimals: number = 0): number {
  const round = (v: number) => Number(v.toFixed(decimals));
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>(0);
  const delayId = useRef<ReturnType<typeof setTimeout>>(0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Respect reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(round(target));
      prevTarget.current = target;
      return;
    }

    const from = prevTarget.current;
    const delta = target - from;

    if (Math.abs(delta) < 0.001) {
      setDisplay(round(target));
      prevTarget.current = target;
      return;
    }

    const startAnim = () => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = cubicBezierEase(progress);
        setDisplay(Number((from + delta * eased).toFixed(decimals)));
        if (progress < 1) {
          rafId.current = requestAnimationFrame(tick);
        } else {
          prevTarget.current = target;
        }
      };
      rafId.current = requestAnimationFrame(tick);
    };

    if (isFirstRun.current) {
      // Stagger first animation by 0-300ms to spread the load across frames
      isFirstRun.current = false;
      const delay = Math.random() * 300;
      delayId.current = setTimeout(startAnim, delay);
    } else {
      startAnim();
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (delayId.current) clearTimeout(delayId.current);
    };
  }, [target, duration, decimals]);

  return display;
}
