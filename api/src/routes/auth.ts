import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../db/database.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = "24h";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

// POST /api/auth/login
router.post("/login", validate({ body: loginSchema }), async (req: Request, res: Response) => {
  if (!JWT_SECRET) {
    res.status(503).json({ error: "Authentication not configured" });
    return;
  }

  const { username, password } = req.body;

  const user = db
    .prepare("SELECT id, username, passwordHash, displayName FROM var_auth WHERE username = ?")
    .get(username) as any;
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Update lastLogin
  db.prepare("UPDATE var_auth SET lastLogin = ? WHERE id = ?").run(new Date().toISOString(), user.id);

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  res.json({
    token,
    user: { username: user.username, displayName: user.displayName || user.username },
  });
});

// GET /api/auth/me
router.get("/me", (req: Request, res: Response) => {
  if (!JWT_SECRET) {
    res.status(503).json({ error: "Authentication not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token" });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const user = db.prepare("SELECT username, displayName FROM var_auth WHERE id = ?").get(payload.userId) as any;
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ username: user.username, displayName: user.displayName || user.username });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
