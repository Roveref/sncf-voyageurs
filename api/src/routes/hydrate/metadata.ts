/**
 * Routes: GET /metadata, GET /skills
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";

const router = Router();

// ── GET /api/hydrate/metadata ──

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        "SELECT empId, grade, gradeHistory, arrivalDate AS arrival, departureDate AS departure, subTeam, serviceLine, managerId FROM employees WHERE gradeHistory IS NOT NULL OR arrivalDate IS NOT NULL"
      )
      .all() as {
      empId: string;
      grade: string | null;
      gradeHistory: string | null;
      arrival: string | null;
      departure: string | null;
      subTeam: string | null;
      serviceLine: string | null;
      managerId: string | null;
    }[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    const employeeMetadata: Record<string, unknown> = {};
    let withGradeHistory = 0;
    let withDeparture = 0;
    for (const row of rows) {
      const gradeHistory = row.gradeHistory ? JSON.parse(row.gradeHistory) : [];
      if (gradeHistory.length > 1) withGradeHistory++;
      if (row.departure) withDeparture++;
      employeeMetadata[row.empId] = {
        gradeHistory,
        arrivalDate: row.arrival,
        departureDate: row.departure,
        ...(row.subTeam && { segment: row.subTeam }),
        ...(row.serviceLine && { serviceLine: row.serviceLine }),
      };
    }

    // Load holidays from var_holidays
    const holidays = db.prepare("SELECT date, name, country FROM var_holidays ORDER BY date").all() as {
      date: string;
      name: string;
      country: string;
    }[];

    res.json({
      available: true,
      employeeMetadata,
      holidays,
      stats: { totalEmployees: rows.length, withGradeHistory, withDeparture },
    });
  } catch (err) {
    error("hydrate/metadata", "Error:", err);
    res.status(500).json({ error: "Error computing metadata." });
  }
});

// ── GET /api/hydrate/skills ──

router.get("/skills", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        `SELECT s.empId, s.name as skillName, s.level, s.category,
                e.name as empName
         FROM hr_skills s
         LEFT JOIN employees e ON s.empId = e.empId
         ORDER BY s.empId`
      )
      .all() as {
      empId: string;
      skillName: string;
      level: number | null;
      category: string | null;
      empName: string | null;
    }[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    // Build per-employee profiles (same structure as buildSkillsProfiles)
    // Serialized as plain objects (Maps/Sets converted to arrays/objects for JSON)
    const empMap: Record<string, any> = {};

    for (const row of rows) {
      const empId = row.empId.replace(/^0+(?=\d)/, ""); // normalize
      if (!empMap[empId]) {
        empMap[empId] = { empId, skills: [], certifications: [] };
      }
      if (row.skillName) {
        empMap[empId].skills.push({
          skillShort: row.skillName,
          skillFull: row.skillName,
          category: row.category || "",
          level: row.level || 0,
          active: true,
        });
      }
    }

    // Build profiles and catalog
    const profiles: Record<string, any> = {};
    const skillIndex: Record<string, string[]> = {};
    const skillMeta: Record<string, { category: string; levels: number[]; count: number }> = {};

    for (const [empId, emp] of Object.entries(empMap) as [string, any][]) {
      const skills = emp.skills;
      const skillsByCategory: Record<string, any[]> = {};
      for (const s of skills) {
        if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
        skillsByCategory[s.category].push(s);
        // Global catalog
        if (!skillIndex[s.skillShort]) skillIndex[s.skillShort] = [];
        skillIndex[s.skillShort].push(empId);
        if (!skillMeta[s.skillShort]) {
          skillMeta[s.skillShort] = { category: s.category, levels: [], count: 0 };
        }
        skillMeta[s.skillShort].levels.push(s.level);
        skillMeta[s.skillShort].count++;
      }

      const topSkills = [...skills].sort((a: any, b: any) => b.level - a.level).slice(0, 5);
      const totalLevel = skills.reduce((s: number, sk: any) => s + sk.level, 0);

      profiles[empId] = {
        empId,
        skills,
        skillsByCategory,
        topSkills,
        skillCount: skills.length,
        avgLevel: skills.length > 0 ? totalLevel / skills.length : 0,
        certifications: emp.certifications,
      };
    }

    const allSkills = Object.entries(skillMeta)
      .map(([short, meta]) => ({
        skillShort: short,
        skillFull: short,
        category: meta.category,
        employeeCount: meta.count,
        avgLevel: meta.levels.reduce((a, b) => a + b, 0) / meta.levels.length,
      }))
      .sort((a, b) => b.employeeCount - a.employeeCount);

    const categories = [...new Set(allSkills.map((s) => s.category))].sort();

    res.json({
      available: true,
      skillsData: {
        profiles, // Record<empId, profile> — frontend converts to Map
        catalog: { allSkills, categories, skillIndex }, // skillIndex as Record — frontend converts to Map<string, Set>
        totalEmployees: Object.keys(profiles).length,
        totalSkills: allSkills.length,
      },
    });
  } catch (err) {
    error("hydrate/skills", "Error:", err);
    res.status(500).json({ error: "Error loading skills data." });
  }
});

export default router;
