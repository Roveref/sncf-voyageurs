/**
 * Route POST /api/pptx/generate — Génère un PPTX GAIF (template hérité)
 */

import { Router, Request, Response } from "express";
import { generatePptx, type PptxSlide } from "../services/pptxExport.js";

const router = Router();

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { slides, title = "Rapport IA" } = req.body as { slides: PptxSlide[]; title?: string };

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      res.status(400).json({ error: "slides array required" });
      return;
    }

    const buffer = await generatePptx(slides, title);

    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const safeTitle = title.replace(/[^a-zA-Z0-9àéèêëïîôùüçÀÉÈÊ ]/g, "_").trim();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_${ts}.pptx"`);
    res.send(buffer);
  } catch (err) {
    console.error("[pptx] Error:", err);
    res.status(500).json({ error: "Failed to generate PPTX", details: String(err) });
  }
});

export default router;
