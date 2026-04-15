import { useState, useRef, useEffect } from "react";

/**
 * useTypewriter -- word-by-word text animation hook.
 * Splits text on whitespace boundaries and reveals one word per interval.
 * When `active` is false the full text is returned immediately.
 */
export function useTypewriter(text: string, active: boolean, speed = 12): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplayed(text);
      return;
    }
    setDisplayed("");
    indexRef.current = 0;
    const words = text.split(/(\s+)/); // preserve whitespace
    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= words.length) {
        setDisplayed(text);
        clearInterval(interval);
      } else {
        setDisplayed(words.slice(0, indexRef.current).join(""));
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return displayed;
}
