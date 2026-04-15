/**
 * Zod validation middleware for Express routes.
 * Validates query params and/or body against zod schemas.
 */

import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema, type ZodIssue, ZodError } from "zod";

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.assign(req.query, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "Validation error",
          details: (err.issues as ZodIssue[]).map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
