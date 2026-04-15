import { calculateRevenueWithSegmentLogic } from "./dataUtils";
import { STATUS_TEXT, EXCLUDED_PARTNER_VALUES } from "./constants";
import { useUserDataStore } from "../stores/useUserDataStore";

// Alias for statusText
const statusText = STATUS_TEXT;

// Function to get technology partner tags from the three columns
const getTechnologyPartnerTags = (opportunity: Record<string, unknown>): string[] => {
  const partners = [opportunity.techPartner1, opportunity.techPartner2, opportunity.techPartner3].filter((partner) => {
    if (!partner) return false;
    const cleanPartner = String(partner).trim();
    return !EXCLUDED_PARTNER_VALUES.includes(cleanPartner);
  });

  // Remove duplicates and return unique partners
  return [...new Set(partners)] as string[];
};

// Safe date formatting
const formatDateSafely = (date: string | Date | null | undefined): string => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("fr-FR");
  } catch (e) {
    return "N/A";
  }
};

/**
 * Export opportunities to a JSON file (unified format compatible with StatusOverrideManager)
 * Exports ALL opportunities (CRM + manual) with actions and comments
 * @param {Array} data - Array of opportunity objects (filtered data)
 * @param {Array} selectedOpportunities - Array of selected opportunity objects
 * @param {boolean} isFiltered - Whether the data is filtered
 * @param {boolean} showNetRevenue - Whether to show net revenue (true) or gross revenue (false)
 */
export const exportOpportunities = (
  data: Record<string, unknown>[],
  selectedOpportunities: Record<string, unknown>[] = [],
  isFiltered = false,
  showNetRevenue = false
): Record<string, unknown> | undefined => {
  // Determine which data to export: selected opportunities or all filtered data
  const dataToExport = selectedOpportunities.length > 0 ? selectedOpportunities : data;

  // Ensure data is an array
  const opportunitiesData = Array.isArray(dataToExport) ? dataToExport : [];

  // If no data, show an alert and return
  if (opportunitiesData.length === 0) {
    alert("No opportunities to export.");
    return;
  }

  // Separate manual opportunities (for import compatibility)
  const manualOpportunities = opportunitiesData.filter((opp) => opp.isManual === true);

  // Collect actions for these opportunities
  const allActions: Record<string, any>[] = [];

  const { opportunityActions } = useUserDataStore.getState();

  opportunitiesData.forEach((opp) => {
    const opportunityId = opp.opportunityId as string;

    const actions = opportunityActions[opportunityId] || [];
    actions.forEach((action) => {
      allActions.push({
        opportunityId: action.opportunityId || opportunityId,
        opportunityName: action.opportunityName || opp.opportunity || "",
        id: action.id,
        owner: action.owner,
        description: action.description,
        dueDate: action.dueDate,
        priority: action.priority,
        status: action.status,
        createdAt: action.createdAt,
      });
    });
  });

  // Create export data in unified format (compatible with StatusOverrideManager)
  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    exportType: selectedOpportunities.length > 0 ? "selected" : isFiltered ? "filtered" : "all",
    // Full opportunities list (for reference/analysis)
    opportunities: opportunitiesData.map((opp) => ({
      ...opp,
      "I&O Revenue": calculateRevenueWithSegmentLogic(opp, showNetRevenue),
    })),
    // StatusOverrideManager compatible fields
    statusOverrides: [],
    manualOpportunities: manualOpportunities.map((opp) => ({
      ...opp,
      exportedAt: new Date().toISOString(),
    })),
    actionsComments: {
      actions: allActions,
    },
  };

  // Download the JSON file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  const exportType = selectedOpportunities.length > 0 ? "selected" : isFiltered ? "filtered" : "all";
  const today = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `opportunities-export-${exportType}-${today}.json`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return exportData;
};

// ──────────────────────────────────────────────────────────────────────────────
// Generic Export Utilities (Excel, CSV, PDF)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a browser download from a Blob
 */
const downloadBlob = (blob: Blob, fileName: string): void => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  // Delay cleanup — Safari needs time to start the download before revoking the URL
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
};

/**
 * Export an array of flat objects to an Excel (.xlsx) file.
 * Uses the xlsx library (already in project dependencies) via dynamic import.
 * Auto-sizes columns based on content width.
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  fileName: string,
  sheetName: string = "Sheet1"
): Promise<void> {
  if (!data || data.length === 0) return;

  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns: measure max width per column
  const headers = Object.keys(data[0]);
  const colWidths = headers.map((header) => {
    let max = header.length;
    for (const row of data) {
      const val = row[header];
      const len = val != null ? String(val).length : 0;
      if (len > max) max = len;
    }
    // Cap at 60 chars width
    return { wch: Math.min(max + 2, 60) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

/**
 * Export an array of flat objects to a CSV file.
 * Handles proper CSV escaping (quotes, commas, newlines).
 */
export function exportToCsv(data: Record<string, unknown>[], fileName: string): void {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);

  const escapeCsvValue = (value: unknown): string => {
    if (value == null) return "";
    const str = String(value);
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  // Header row
  lines.push(headers.map(escapeCsvValue).join(","));
  // Data rows
  for (const row of data) {
    lines.push(headers.map((h) => escapeCsvValue(row[h])).join(","));
  }

  const csvContent = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" }); // BOM for Excel compat
  downloadBlob(blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
}

/**
 * Export the current view to PDF via the browser's print dialog.
 * Temporarily hides everything except the target element, then calls window.print().
 * The @media print rules in styles.css handle additional cleanup.
 */
export function exportToPdf(elementId: string, _fileName: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`exportToPdf: element #${elementId} not found`);
    return;
  }

  // Add a class to the body so @media print rules can scope visibility
  document.body.classList.add("print-export-active");
  element.classList.add("print-export-target");

  window.print();

  // Cleanup after print dialog closes
  // Use setTimeout to let the print dialog fully close first
  setTimeout(() => {
    document.body.classList.remove("print-export-active");
    element.classList.remove("print-export-target");
  }, 500);
}

// ──────────────────────────────────────────────────────────────────────────────
// High-Quality Export for PowerPoint (PNG @3x + SVG)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deep-inline all computed styles on a cloned element tree so it renders standalone.
 */
function inlineAllStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  // Copy ALL computed styles (not just a subset)
  let cssText = "";
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    cssText += `${prop}:${computed.getPropertyValue(prop)};`;
  }
  (target as HTMLElement).style.cssText = cssText;

  const srcChildren = source.children;
  const tgtChildren = target.children;
  for (let i = 0; i < srcChildren.length; i++) {
    if (tgtChildren[i]) inlineAllStyles(srcChildren[i], tgtChildren[i]);
  }
}

/**
 * Capture a DOM element as a high-resolution PNG (3x scale for Retina/PPT quality).
 * Uses html2canvas-pro with onclone to inline all computed styles (resolves CSS variables).
 */
export async function exportElementToPng(element: HTMLElement, fileName: string, scale: number = 3): Promise<void> {
  // Render to off-screen canvas using DOM-to-image approach:
  // 1. Clone element with all computed styles inlined
  // 2. Serialize into SVG foreignObject
  // 3. Load as image via data URI (avoids tainted canvas from blob URL)
  // 4. Draw to canvas → export PNG
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  const clone = element.cloneNode(true) as HTMLElement;
  inlineAllStyles(element, clone);
  const isDark = document.documentElement.classList.contains("dark");
  clone.style.backgroundColor = isDark ? "#1a1a2e" : "#ffffff";
  clone.style.margin = "0";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgMarkup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">${serialized}</foreignObject>` +
    `</svg>`;

  // Data URI (not blob URL) avoids tainted canvas in most browsers
  const dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, fileName.endsWith(".png") ? fileName : `${fileName}.png`);
    }, "image/png");
  };
  img.onerror = () => {
    // Fallback: download the SVG directly
    const blob = new Blob([svgMarkup], { type: "application/octet-stream" });
    downloadBlob(blob, fileName.replace(/\.png$/, ".svg"));
  };
  img.src = dataUri;
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG Card Export (PowerPoint-compatible)
// ──────────────────────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Inline essential visual styles on an SVG element tree for standalone rendering.
 * Preserves existing SVG attributes (fill, stroke, etc.) — only adds CSS-computed
 * values for properties not already set as attributes.
 */
function inlineSvgStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);

  // Properties that can be SVG attributes — only inline if not already an attribute
  const attrProps = ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity"];
  // Properties that are CSS-only — always inline
  const cssProps = ["font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline"];

  const styles: string[] = [];
  for (const prop of attrProps) {
    const camel = prop.replace(/-./g, (m) => m[1].toUpperCase());
    if (!target.hasAttribute(prop) && !target.hasAttribute(camel)) {
      const val = computed.getPropertyValue(prop);
      if (val && val !== "none" && val !== "0") styles.push(`${prop}:${val}`);
    }
  }
  for (const prop of cssProps) {
    const val = computed.getPropertyValue(prop);
    if (val) styles.push(`${prop}:${val}`);
  }

  if (styles.length > 0) {
    const existing = target.getAttribute("style") || "";
    target.setAttribute("style", existing ? `${existing};${styles.join(";")}` : styles.join(";"));
  }

  for (let i = 0; i < source.children.length; i++) {
    if (target.children[i]) inlineSvgStyles(source.children[i], target.children[i]);
  }
}

/** Convert CSS color (rgb/rgba/hex/named) to #RRGGBB hex for PPT compatibility. */
function colorToHex(color: string): string | null {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
  // Already hex
  if (color.startsWith("#")) return color;
  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const [, r, g, b] = m;
    // Skip fully transparent rgba
    const aMatch = color.match(/,\s*([\d.]+)\s*\)/);
    if (aMatch && parseFloat(aMatch[1]) === 0) return null;
    return "#" + [r, g, b].map((c) => parseInt(c).toString(16).padStart(2, "0")).join("");
  }
  return color;
}

/**
 * Walk a DOM subtree and emit native SVG primitives for every visible element.
 * - Elements with background-color → <rect>
 * - Text nodes → <text>
 * - <hr> / MuiDivider → <line>
 * - Borders → <rect> with stroke
 * All positions are relative to `origin` (the card's bounding rect).
 */
function domToSvgPrimitives(root: Element, svg: SVGSVGElement, origin: DOMRect): void {
  // Pass 1: collect all rects (backgrounds, dividers) in DOM order (correct z-order)
  // Pass 2: collect all text on top

  const rects: SVGElement[] = [];
  const texts: SVGElement[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        const parent = node.parentElement;
        if (parent) {
          const cs = window.getComputedStyle(parent);
          if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") {
            node = walker.nextNode();
            continue;
          }

          // Use Range for exact text position (not parent bounding box)
          const range = document.createRange();
          range.selectNode(node);
          const r = range.getBoundingClientRect();
          range.detach();
          if (r.width === 0 || r.height === 0) {
            node = walker.nextNode();
            continue;
          }

          const textEl = document.createElementNS(SVG_NS, "text");
          const x = r.left - origin.left;
          const fontSize = parseFloat(cs.fontSize) || 14;
          const y = r.top - origin.top + r.height / 2;
          textEl.setAttribute("x", String(Math.round(x)));
          textEl.setAttribute("y", String(Math.round(y)));
          textEl.setAttribute("font-family", cs.fontFamily || "sans-serif");
          textEl.setAttribute("font-size", String(Math.round(fontSize)));
          textEl.setAttribute("fill", colorToHex(cs.color) || "#000000");
          textEl.setAttribute("dominant-baseline", "central");
          if (parseInt(cs.fontWeight) >= 600) textEl.setAttribute("font-weight", cs.fontWeight);
          textEl.textContent = text;
          texts.push(textEl);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") {
        node = walker.nextNode();
        continue;
      }

      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        node = walker.nextNode();
        continue;
      }

      const x = Math.round(r.left - origin.left);
      const y = Math.round(r.top - origin.top);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      const bgColor = cs.backgroundColor;
      const borderRadius = parseFloat(cs.borderRadius) || 0;

      // Dividers
      if (el.tagName === "HR" || el.classList.contains("MuiDivider-root")) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(x));
        line.setAttribute("y1", String(y));
        line.setAttribute("x2", String(x + w));
        line.setAttribute("y2", String(y));
        line.setAttribute("stroke", colorToHex(cs.borderTopColor) || "#e0e0e0");
        line.setAttribute("stroke-width", "1");
        rects.push(line);
      }
      // Background blocks (skip fully transparent)
      else if (bgColor) {
        const hexBg = colorToHex(bgColor);
        if (!hexBg) {
          node = walker.nextNode();
          continue;
        }
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(w));
        rect.setAttribute("height", String(h));
        rect.setAttribute("fill", hexBg);
        if (borderRadius > 0) rect.setAttribute("rx", String(Math.round(borderRadius)));
        // No stroke by default — explicit to prevent PPT "convert to object" adding black
        rect.setAttribute("stroke", "none");
        rects.push(rect);
      }
    }

    node = walker.nextNode();
  }

  // Append rects first (backgrounds), then texts on top
  rects.forEach((el) => svg.appendChild(el));
  texts.forEach((el) => svg.appendChild(el));
}

/**
 * Export a card as PowerPoint-compatible SVG.
 *
 * Cards WITH a Recharts chart → flat native SVG (no nested <svg>, no foreignObject).
 * Cards WITHOUT chart → DOM-to-SVG conversion (backgrounds → <rect>, text → <text>).
 */
export function exportCardAsSvg(card: HTMLElement, fileName: string): void {
  const PADDING = 16;
  const TITLE_SIZE = 18;
  const TITLE_GAP = 12;

  // ── Find chart SVG ──
  let chartSvg = card.querySelector<SVGSVGElement>(".recharts-wrapper > svg, svg.recharts-surface");
  if (!chartSvg) {
    const allSvgs = card.querySelectorAll<SVGSVGElement>("svg");
    let bestArea = 0;
    allSvgs.forEach((svg) => {
      if (svg.classList.contains("MuiSvgIcon-root")) return;
      if (svg.classList.contains("card-export-curl-icon")) return;
      const r = svg.getBoundingClientRect();
      const a = r.width * r.height;
      if (a > bestArea) {
        bestArea = a;
        chartSvg = svg;
      }
    });
    if (bestArea < 2500) chartSvg = null;
  }

  // ── Find title ──
  const heading = card.querySelector(
    "h1, h2, h3, h4, h5, h6, .MuiTypography-h5, .MuiTypography-h6, .MuiTypography-subtitle1"
  );
  const titleText = heading?.textContent?.trim() || "";

  // ── No chart → convert HTML to native SVG primitives ──
  if (!chartSvg) {
    const cardRect = card.getBoundingClientRect();
    const w = Math.ceil(cardRect.width);
    const h = Math.ceil(cardRect.height);
    const isDark = document.documentElement.classList.contains("dark");

    const outerSvg = document.createElementNS(SVG_NS, "svg");
    outerSvg.setAttribute("xmlns", SVG_NS);
    outerSvg.setAttribute("width", String(w));
    outerSvg.setAttribute("height", String(h));

    // Background
    const bgRect = document.createElementNS(SVG_NS, "rect");
    bgRect.setAttribute("width", String(w));
    bgRect.setAttribute("height", String(h));
    bgRect.setAttribute("fill", isDark ? "#1a1a2e" : "#ffffff");
    bgRect.setAttribute("rx", "12");
    outerSvg.appendChild(bgRect);

    // Walk the DOM and convert visible elements to SVG primitives
    domToSvgPrimitives(card, outerSvg, cardRect);

    // Serialize and download
    const serializer = new XMLSerializer();
    const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(outerSvg);
    downloadBlob(new Blob([svgString], { type: "application/octet-stream" }), fileName);
    return;
  }

  // ── Has chart → build flat native SVG via DOM API ──

  // 1. Clone and inline styles
  const chartClone = chartSvg.cloneNode(true) as SVGSVGElement;
  inlineSvgStyles(chartSvg, chartClone);

  // 2. Clean transient elements from clone
  chartClone
    .querySelectorAll(".recharts-tooltip-wrapper, .recharts-active-dot, .recharts-tooltip-cursor")
    .forEach((el) => el.remove());

  // 3. Strip class attributes (PPT compatibility)
  chartClone.querySelectorAll("[class]").forEach((el) => el.removeAttribute("class"));
  chartClone.removeAttribute("class");

  // 4. Measure chart
  const chartBox = chartSvg.getBoundingClientRect();
  const chartW = Math.ceil(chartBox.width);
  const chartH = Math.ceil(chartBox.height);

  // 5. Read title font from DOM
  const headingStyle = heading ? window.getComputedStyle(heading) : null;
  const fontFamily = headingStyle?.fontFamily || "sans-serif";
  const fontWeight = headingStyle?.fontWeight || "700";
  const titleColor = colorToHex(headingStyle?.color || "") || "#333333";

  // 6. Calculate layout
  const titleBlockH = titleText ? TITLE_SIZE + TITLE_GAP : 0;
  const totalW = chartW + PADDING * 2;
  const totalH = chartH + titleBlockH + PADDING * 2;
  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#1a1a2e" : "#ffffff";

  // 7. Build outer SVG using DOM API (no string concat, no nested <svg>)
  const outerSvg = document.createElementNS(SVG_NS, "svg");
  outerSvg.setAttribute("xmlns", SVG_NS);
  outerSvg.setAttribute("width", String(totalW));
  outerSvg.setAttribute("height", String(totalH));

  // Background
  const bgRect = document.createElementNS(SVG_NS, "rect");
  bgRect.setAttribute("width", String(totalW));
  bgRect.setAttribute("height", String(totalH));
  bgRect.setAttribute("fill", bg);
  bgRect.setAttribute("rx", "12");
  outerSvg.appendChild(bgRect);

  // Title
  if (titleText) {
    const titleEl = document.createElementNS(SVG_NS, "text");
    titleEl.setAttribute("x", String(PADDING));
    titleEl.setAttribute("y", String(PADDING + TITLE_SIZE));
    titleEl.setAttribute("font-family", fontFamily);
    titleEl.setAttribute("font-size", String(TITLE_SIZE));
    titleEl.setAttribute("font-weight", fontWeight);
    titleEl.setAttribute("fill", titleColor);
    titleEl.textContent = titleText;
    outerSvg.appendChild(titleEl);
  }

  // 8. Hoist <defs> from chart clone to outer SVG root
  const defs = chartClone.querySelector("defs");
  if (defs) outerSvg.appendChild(defs);

  // 9. Move all remaining children into a translated <g>
  const chartGroup = document.createElementNS(SVG_NS, "g");
  chartGroup.setAttribute("transform", `translate(${PADDING}, ${PADDING + titleBlockH})`);
  while (chartClone.firstChild) {
    chartGroup.appendChild(chartClone.firstChild);
  }
  outerSvg.appendChild(chartGroup);

  // 10. Serialize and download
  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(outerSvg);
  downloadBlob(new Blob([svgString], { type: "application/octet-stream" }), fileName);
}

/**
 * Copy an element as PNG to the system clipboard.
 * Requires secure context (HTTPS or localhost) and user gesture.
 */
export async function copyElementToClipboard(element: HTMLElement, scale = 3): Promise<void> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(element, { scale, useCORS: true, logging: false });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png")
  );
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/**
 * Extract an SVG element (e.g. a Recharts chart) and download it as a standalone .svg file.
 * Inlines computed styles so the SVG renders correctly outside the page.
 */
export function exportSvgElement(svgElement: SVGSVGElement, fileName: string): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Ensure width/height attributes are set
  const bbox = svgElement.getBoundingClientRect();
  clone.setAttribute("width", String(Math.ceil(bbox.width)));
  clone.setAttribute("height", String(Math.ceil(bbox.height)));
  clone.setAttribute("xmlns", SVG_NS);

  inlineSvgStyles(svgElement, clone);

  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);

  // Use octet-stream to force download (Safari opens save dialog for image/svg+xml)
  const blob = new Blob([svgString], { type: "application/octet-stream" });
  downloadBlob(blob, fileName.endsWith(".svg") ? fileName : `${fileName}.svg`);
}

/**
 * Extract an SVG element as a standalone SVG string with inlined styles.
 * Returns the base64-encoded SVG (without data URI prefix).
 */
export function svgToBase64(svgElement: SVGSVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const bbox = svgElement.getBoundingClientRect();
  clone.setAttribute("width", String(Math.ceil(bbox.width)));
  clone.setAttribute("height", String(Math.ceil(bbox.height)));
  clone.setAttribute("xmlns", SVG_NS);

  inlineSvgStyles(svgElement, clone);

  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
  return btoa(unescape(encodeURIComponent(svgString)));
}

/**
 * Find all Recharts SVG elements inside a container and export them individually.
 * Returns the number of charts exported.
 */
export function exportAllChartsSvg(container: HTMLElement, filePrefix: string): number {
  const svgs = container.querySelectorAll<SVGSVGElement>(".recharts-wrapper > svg");
  let count = 0;
  svgs.forEach((svg, i) => {
    const chartName = svg.closest("[data-chart-name]")?.getAttribute("data-chart-name") || `chart-${i + 1}`;
    exportSvgElement(svg, `${filePrefix}_${chartName}.svg`);
    count++;
  });
  return count;
}

/**
 * Export a DOM element as high-quality PNG + all charts inside as individual SVGs.
 * Ideal for PowerPoint: PNG for the full view, SVGs for editable vector charts.
 */
export async function exportForPowerPoint(
  elementId: string,
  filePrefix: string
): Promise<{ pngExported: boolean; svgCount: number }> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`exportForPowerPoint: element #${elementId} not found`);
    return { pngExported: false, svgCount: 0 };
  }

  // Export full view as high-res PNG
  await exportElementToPng(element, `${filePrefix}_full.png`, 3);

  // Export individual charts as SVG
  const svgCount = exportAllChartsSvg(element, filePrefix);

  return { pngExported: true, svgCount };
}

/**
 * Generate a PPTX file via the backend API and trigger download.
 */
export async function exportPptxViaApi(
  slides: Array<{
    layout: string;
    title?: string;
    subtitle?: string;
    body?: string;
    leftContent?: string;
    rightContent?: string;
    imageBase64?: string;
    svgBase64?: string;
  }>,
  title: string
): Promise<void> {
  const { apiFetch } = await import("../services/api");
  const API_BASE = import.meta.env.VITE_API_BASE || "/api";
  const res = await apiFetch(`${API_BASE}/pptx/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slides, title }),
  });
  if (!res.ok) throw new Error(`PPTX generation failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().split("T")[0];
  a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${ts}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Flatten opportunity objects into a simple row format suitable for Excel/CSV export.
 * Picks human-readable columns from the raw CRM opportunity records.
 */
export const flattenOpportunitiesForExport = (
  opportunities: Record<string, unknown>[],
  showNetRevenue: boolean = false
): Record<string, unknown>[] => {
  return opportunities.map((opp) => {
    const revenue = showNetRevenue ? opp.netRevenue : opp.grossRevenue;
    const ioRevenue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);
    const partners = getTechnologyPartnerTags(opp);

    return {
      opportunityId: opp.opportunityId ?? "",
      opportunity: opp.opportunity ?? "",
      Account: opp.account ?? "",
      Status: statusText[opp.status as number] ?? opp.status ?? "",
      winPct: opp.winPct != null ? `${Math.round(opp.winPct as number)}%` : "",
      Revenue: typeof revenue === "number" ? Math.round(revenue) : (revenue ?? ""),
      "I&O Revenue": typeof ioRevenue === "number" ? Math.round(ioRevenue) : (ioRevenue ?? ""),
      creationDate: formatDateSafely(opp.creationDate as string | Date | null),
      "Start Date": formatDateSafely(opp.creationDate as string | Date | null),
      "Close Date": formatDateSafely(opp.estimatedBookingDate as string | Date | null),
      "Service Line": opp.serviceLine1 ?? "",
      Segment: opp.subSegmentCode ?? "",
      Owner: opp.manager ?? "",
      "Technology Partners": partners.join(", "),
      Manual: opp.isManual ? "Yes" : "",
    };
  });
};
