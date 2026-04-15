import { useEffect, useRef, useState } from "react";

/**
 * Detects when an element enters the viewport using IntersectionObserver.
 * Returns a ref to attach to the element and a boolean indicating visibility.
 * Once triggered (once=true by default), disconnects the observer.
 * Respects prefers-reduced-motion — always returns true immediately if enabled.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; once?: boolean; rootMargin?: string } = {}
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0.1, once = true, rootMargin = "0px" } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // Respect reduced motion — skip animation, show immediately
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  return [ref, inView];
}
