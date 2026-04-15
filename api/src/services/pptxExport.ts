/**
 * Export PPTX — Génère un .pptx à partir du template BearingPoint .potx
 *
 * Ouvre le template, supprime les slides d'exemple, injecte de nouvelles slides
 * avec le contenu de l'analyse IA, en référençant les layouts existants.
 */

import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../../templates/BearingPoint_ppt_tmpl_BestPractice.potx");

// Layout indices (1-based, matching slideLayout{N}.xml)
const LAYOUTS = {
  TITLE_RED: 1, // "Title slide - Bearing red" — title + body
  CHAPTER: 8, // "Chapter" — title + body
  DIVIDER: 11, // "Divider" — title only
  CONTENT_LARGE: 17, // "Content large" — content + body (title area)
  CONTENT_TWO_COL: 20, // "Content two column" — 2x content + body
  END_RED: 30, // "End slide - Bearing red" — body
};

export interface PptxSlide {
  layout: "title" | "chapter" | "content" | "two_column" | "end";
  title?: string;
  subtitle?: string;
  body?: string;
  leftContent?: string;
  rightContent?: string;
  /** Base64-encoded PNG fallback image */
  imageBase64?: string;
  /** Base64-encoded SVG image (primary, used by Office 2019+ / 365) */
  svgBase64?: string;
}

/**
 * Generate a PPTX file from the BearingPoint template with custom slides.
 * Returns the PPTX as a Buffer.
 */
export async function generatePptx(slides: PptxSlide[], reportTitle: string): Promise<Buffer> {
  // Read template (with existence check)
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`PPTX template not found: ${TEMPLATE_PATH}. Ensure the .potx file is in the project root.`);
  }
  const templateBuf = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  // Remove all existing example slides + their relationships
  const existingSlides = Object.keys(zip.files).filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/));
  const existingRels = Object.keys(zip.files).filter((f) => f.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/));
  const existingNotes = Object.keys(zip.files).filter((f) => f.match(/^ppt\/notesSlides\//));
  const existingNoteRels = Object.keys(zip.files).filter((f) => f.match(/^ppt\/notesSlides\/_rels\//));
  const existingCharts = Object.keys(zip.files).filter((f) => f.match(/^ppt\/charts\//));
  const existingEmbed = Object.keys(zip.files).filter((f) => f.match(/^ppt\/embeddings\//));
  const existingTags = Object.keys(zip.files).filter((f) => f.match(/^ppt\/tags\//));

  for (const f of [
    ...existingSlides,
    ...existingRels,
    ...existingNotes,
    ...existingNoteRels,
    ...existingCharts,
    ...existingEmbed,
    ...existingTags,
  ]) {
    zip.remove(f);
  }

  // Build new slides
  const slideXmls: string[] = [];
  const slideRels: string[] = [];
  const layoutMap: Record<string, number> = {
    title: LAYOUTS.TITLE_RED,
    chapter: LAYOUTS.CHAPTER,
    content: LAYOUTS.CONTENT_LARGE,
    two_column: LAYOUTS.CONTENT_TWO_COL,
    end: LAYOUTS.END_RED,
  };

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const layoutIdx = layoutMap[slide.layout] || LAYOUTS.CONTENT_LARGE;
    const slideNum = i + 1;
    const hasPng = !!slide.imageBase64;
    const hasSvg = !!slide.svgBase64;
    const hasImage = hasPng || hasSvg;

    // Store embedded images in ppt/media/
    if (hasPng) {
      zip.file(`ppt/media/image_slide${slideNum}.png`, Buffer.from(slide.imageBase64!, "base64"));
    }
    if (hasSvg) {
      zip.file(`ppt/media/image_slide${slideNum}.svg`, Buffer.from(slide.svgBase64!, "base64"));
    }

    // Build slide XML
    const slideXml = buildSlideXml(slide, layoutIdx, hasImage, hasSvg);
    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);

    // Build slide relationship (points to layout + optional images)
    const relXml = buildSlideRels(layoutIdx, hasImage ? slideNum : undefined, hasSvg);
    zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, relXml);
  }

  // Update presentation.xml — replace slide list
  const presXml = await zip.file("ppt/presentation.xml")!.async("string");
  const newPresXml = updatePresentationXml(presXml, slides.length);
  zip.file("ppt/presentation.xml", newPresXml);

  // Update presentation.xml.rels — add slide relationships
  const presRels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  const newPresRels = updatePresentationRels(presRels, slides.length);
  zip.file("ppt/_rels/presentation.xml.rels", newPresRels);

  // Update [Content_Types].xml — add slide content types
  const ctXml = await zip.file("[Content_Types].xml")!.async("string");
  const hasImages = slides.map((s) => !!s.imageBase64);
  const newCtXml = updateContentTypes(ctXml, slides.length, hasImages);
  zip.file("[Content_Types].xml", newCtXml);

  // Generate the output
  const output = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return output;
}

// ── XML builders ──

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildTextParagraphs(text: string, fontSize = 1400, bold = false): string {
  return text
    .split("\n")
    .map((line) => {
      const isBullet = line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ");
      const cleanLine = isBullet ? line.replace(/^\s*[-*]\s*/, "") : line;
      const isBold = line.startsWith("**") && line.endsWith("**");
      const displayLine = isBold ? cleanLine.replace(/\*\*/g, "") : cleanLine;
      return `<a:p>${isBullet ? '<a:pPr marL="228600" indent="-228600"><a:buChar char="&#x2022;"/></a:pPr>' : "<a:pPr/>"}
      <a:r><a:rPr lang="fr-FR" sz="${fontSize}" b="${bold || isBold ? 1 : 0}" dirty="0"/><a:t>${escXml(displayLine)}</a:t></a:r></a:p>`;
    })
    .join("\n");
}

/** Build a <p:pic> element for an embedded image. Position: right half of slide for content layouts. */
function buildPicXml(pngRId: string, svgRId?: string): string {
  // EMU units: slide is 12192000 x 6858000 (25.4cm x 19.05cm at 96dpi)
  // Image occupies roughly the right 55% of the slide, below the title area
  const x = 5334000; // ~14cm from left
  const y = 1524000; // ~4cm from top (below title)
  const cx = 6400000; // ~16.8cm wide
  const cy = 4800000; // ~12.6cm tall
  // SVG extension: Office 2019+ renders SVG, older versions fall back to PNG
  const svgExt = svgRId
    ? `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRId}"/></a:ext></a:extLst>`
    : "";
  return `<p:pic>
        <p:nvPicPr><p:cNvPr id="10" name="Chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="${pngRId}">${svgExt}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>`;
}

function buildSlideXml(slide: PptxSlide, layoutIdx: number, hasImage = false, hasSvg = false): string {
  const ns =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const picXml = hasImage ? buildPicXml("rId2", hasSvg ? "rId3" : undefined) : "";

  if (slide.layout === "title") {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${ns}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.title || "", 2800, true)}
      </p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.subtitle || "", 1600)}
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  if (slide.layout === "chapter") {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${ns}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.title || "", 2400, true)}
      </p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.body || "", 1400)}
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  if (slide.layout === "end") {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${ns}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.body || "Merci", 2000, true)}
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  // Default: content (layout 17 — Content large)
  // When image is present: text on the left, chart image on the right
  // When no image: text fills the content area
  const bodySpPr = hasImage
    ? `<a:xfrm><a:off x="457200" y="1524000"/><a:ext cx="4572000" cy="4800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${ns}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="15"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.title || "", 2000, true)}
      </p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="13"/></p:nvPr></p:nvSpPr><p:spPr>${bodySpPr}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>
        ${buildTextParagraphs(slide.body || "", 1200)}
      </p:txBody></p:sp>
      ${picXml}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

function buildSlideRels(layoutIdx: number, imageSlideNum?: number, hasSvg = false): string {
  const pngRel =
    imageSlideNum != null
      ? `\n  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image_slide${imageSlideNum}.png"/>`
      : "";
  const svgRel =
    imageSlideNum != null && hasSvg
      ? `\n  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image_slide${imageSlideNum}.svg"/>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutIdx}.xml"/>${pngRel}${svgRel}
</Relationships>`;
}

function updatePresentationXml(xml: string, slideCount: number): string {
  // Replace the entire sldIdLst with new slide references
  const slideEntries = Array.from(
    { length: slideCount },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`
  ).join("\n    ");

  // Replace existing sldIdLst
  xml = xml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>\n    ${slideEntries}\n  </p:sldIdLst>`);

  return xml;
}

function updatePresentationRels(xml: string, slideCount: number): string {
  // Remove existing slide relationships
  xml = xml.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>\s*/g, "");

  // Add new slide relationships before closing tag
  const newRels = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Relationship Id="rId${100 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join("\n  ");

  xml = xml.replace("</Relationships>", `  ${newRels}\n</Relationships>`);

  return xml;
}

function updateContentTypes(xml: string, slideCount: number, hasImages: boolean[]): string {
  // Remove existing slide overrides
  xml = xml.replace(/<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>\s*/g, "");
  xml = xml.replace(/<Override[^>]*PartName="\/ppt\/notesSlides\/[^"]*"[^>]*\/>\s*/g, "");
  xml = xml.replace(/<Override[^>]*PartName="\/ppt\/charts\/[^"]*"[^>]*\/>\s*/g, "");

  // Ensure PNG + SVG default extensions exist
  if (!xml.includes('Extension="png"')) {
    xml = xml.replace(/<Default[^>]*\/>/, (m) => `${m}\n  <Default Extension="png" ContentType="image/png"/>`);
  }
  if (hasImages.some(Boolean) && !xml.includes('Extension="svg"')) {
    xml = xml.replace(/<Default[^>]*\/>/, (m) => `${m}\n  <Default Extension="svg" ContentType="image/svg+xml"/>`);
  }

  // Add new slide overrides
  const newOverrides = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("\n  ");

  xml = xml.replace("</Types>", `  ${newOverrides}\n</Types>`);

  return xml;
}
