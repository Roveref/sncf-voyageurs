/**
 * Side-effect module: loads api/.env into process.env when the file is imported.
 *
 * Used by standalone scripts (e.g. agentEval.ts) so they don't need the
 * `--env-file=.env` flag. The dev server already loads .env via tsx, and
 * `process.loadEnvFile()` does NOT override existing vars, so this is a no-op
 * in that context.
 *
 * Requires Node ≥ 20.6 (no dotenv dependency).
 */
import path from "path";
import { fileURLToPath } from "url";

try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  process.loadEnvFile(path.resolve(here, "../../.env"));
} catch {
  /* .env missing or already loaded — fine */
}
