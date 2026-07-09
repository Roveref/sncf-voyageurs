/**
 * GlobalCardExport — Adds a page-curl export effect to ALL MUI Card/Paper elements.
 *
 * Mount once at the app root. Uses CSS for the visual effect and event delegation
 * for the click handler. No need to wrap individual components.
 *
 * Behavior:
 * - Hover near the top-right corner of any Card/Paper → page curl animation
 * - Click the curl → exports SVG if a Recharts chart is inside, otherwise PNG screenshot
 */

import { memo, useEffect, useRef } from "react";
import { exportCardAsSvg, copyElementToClipboard } from "../../utils/exportUtils";

const CURL_SIZE = 40;
const HOVER_ZONE = 25;

// Inline styles injected once via <style> tag
const STYLE_ID = "global-card-export-styles";

const CSS = `
/* Page curl — injected by GlobalCardExport */

.card-export-curl {
  position: absolute;
  top: 0;
  right: 0;
  width: ${CURL_SIZE}px;
  height: ${CURL_SIZE}px;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-export-curl.visible {
  opacity: 1;
}

/* Opaque background to hide card content behind the curl */
.card-export-curl::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: ${CURL_SIZE}px;
  height: ${CURL_SIZE}px;
  background: #ffffff;
  z-index: 0;
}

[data-theme="dark"] .card-export-curl::after,
.dark .card-export-curl::after {
  background: #121212;
}

/* Folded triangle on top */
.card-export-curl::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: ${CURL_SIZE}px;
  height: ${CURL_SIZE}px;
  background: linear-gradient(225deg, #f0f0f0 44%, #d4d4d4 50%, transparent 50%);
  border-radius: 0 0 0 4px;
  box-shadow: -2px 2px 5px rgba(0,0,0,0.15);
  z-index: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="dark"] .card-export-curl::before,
.dark .card-export-curl::before {
  background: linear-gradient(225deg, #2a2a3e 44%, #1e1e30 50%, transparent 50%);
  box-shadow: -2px 2px 5px rgba(0,0,0,0.3);
}

/* Download icon */
.card-export-curl-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 16px;
  height: 16px;
  pointer-events: none;
  opacity: 0.45;
  z-index: 2;
}

[data-theme="dark"] .card-export-curl-icon,
.dark .card-export-curl-icon {
  opacity: 0.5;
  filter: invert(1);
}

/* Clickable zone */
.card-export-zone {
  position: absolute;
  top: 0;
  right: 0;
  width: ${HOVER_ZONE}px;
  height: ${HOVER_ZONE}px;
  z-index: 21;
  cursor: pointer;
}

@media print {
  .card-export-curl, .card-export-zone { display: none !important; }
}
`;

const DOWNLOAD_SVG_PATH = "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z";

function getCardName(card: HTMLElement): string {
  // Try data attribute first
  const name = card.getAttribute("data-export-name");
  if (name) return name;
  // Try to find a heading inside
  const heading = card.querySelector(
    "h1, h2, h3, h4, h5, h6, .MuiTypography-h5, .MuiTypography-h6, .MuiTypography-subtitle1"
  );
  if (heading?.textContent) {
    return heading.textContent
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 40);
  }
  return "card";
}

function handleCardExport(card: HTMLElement) {
  const name = getCardName(card);
  const today = new Date().toISOString().split("T")[0];
  const prefix = `${name}_${today}`;
  exportCardAsSvg(card, `${prefix}.svg`);
}

const GlobalCardExport = memo(() => {
  const activeCard = useRef<HTMLElement | null>(null);
  const curlEl = useRef<HTMLDivElement | null>(null);
  const zoneEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Inject styles
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // Create shared curl overlay (reused across cards)
    const curl = document.createElement("div");
    curl.className = "card-export-curl";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "card-export-curl-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", DOWNLOAD_SVG_PATH);
    svg.appendChild(path);
    curl.appendChild(svg);
    curlEl.current = curl;

    const zone = document.createElement("div");
    zone.className = "card-export-zone";
    zone.title = "Cliquer pour exporter en SVG · Maj+clic pour copier";
    zoneEl.current = zone;

    function findCard(el: HTMLElement | null): HTMLElement | null {
      while (el) {
        if (el.classList?.contains("MuiCard-root") || el.classList?.contains("MuiPaper-root")) {
          // Skip tooltips, popovers, menus, dialogs, appbar, drawers
          if (
            el.closest(
              ".MuiTooltip-popper, .MuiPopover-root, .MuiMenu-root, .MuiDialog-root, .MuiPopper-root, .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root"
            )
          ) {
            return null;
          }
          // Skip Papers that are direct layout containers (full-width or full-height)
          const cs = window.getComputedStyle(el);
          if (cs.position === "fixed" || cs.position === "sticky") return null;
          // Skip very small elements (chips, badges)
          const rect = el.getBoundingClientRect();
          if (rect.width < 120 || rect.height < 80) return null;
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    function isInCorner(e: MouseEvent, card: HTMLElement): boolean {
      const rect = card.getBoundingClientRect();
      const dx = rect.right - e.clientX;
      const dy = e.clientY - rect.top;
      // Must be within HOVER_ZONE radius of the top-right corner
      return dx >= 0 && dx <= HOVER_ZONE && dy >= 0 && dy <= HOVER_ZONE;
    }

    function showCurl(card: HTMLElement) {
      if (activeCard.current === card) return;
      hideCurl();
      activeCard.current = card;
      // Only set position:relative if the card doesn't already have a positioned layout
      const pos = window.getComputedStyle(card).position;
      if (pos === "static") card.style.position = "relative";
      card.appendChild(curl);
      card.appendChild(zone);
      requestAnimationFrame(() => curl.classList.add("visible"));
    }

    function hideCurl() {
      curl.classList.remove("visible");
      if (activeCard.current) {
        // Restore original position
        if (activeCard.current.style.position === "relative") {
          activeCard.current.style.position = "";
        }
        try {
          activeCard.current.removeChild(curl);
          activeCard.current.removeChild(zone);
        } catch {
          /* already removed */
        }
        activeCard.current = null;
      }
    }

    let rafId: number | null = null;
    function onMouseMove(e: MouseEvent) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = e.target as HTMLElement;
        // If hovering over the zone itself, keep showing
        if (target === zone || zone.contains(target)) return;

        const card = findCard(target);
        if (card && isInCorner(e, card)) {
          showCurl(card);
        } else if (activeCard.current) {
          // Check if still in corner of active card
          if (activeCard.current && isInCorner(e, activeCard.current)) return;
          hideCurl();
        }
      });
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target === zone || zone.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        if (activeCard.current) {
          const card = activeCard.current;
          hideCurl();
          if (e.shiftKey) {
            copyElementToClipboard(card)
              .then(() => {
                const toast = document.createElement("div");
                toast.textContent = "Copied to clipboard";
                Object.assign(toast.style, {
                  position: "fixed",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#333",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  zIndex: "9999",
                  opacity: "1",
                  transition: "opacity 0.3s",
                });
                document.body.appendChild(toast);
                setTimeout(() => {
                  toast.style.opacity = "0";
                  setTimeout(() => toast.remove(), 300);
                }, 1500);
              })
              .catch(() => {
                /* clipboard not available */
              });
            return;
          }
          handleCardExport(card);
        }
      }
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    zone.addEventListener("click", onClick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMouseMove);
      zone.removeEventListener("click", onClick);
      hideCurl();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null; // Renders nothing — all behavior is via DOM
});

GlobalCardExport.displayName = "GlobalCardExport";
export default GlobalCardExport;
