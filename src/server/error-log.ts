import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/** Appends one JSON line per server error to ./logs/errors.log. */
export async function logServerError(entry: Record<string, unknown>) {
  const dir = path.join(process.cwd(), "logs");
  try {
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await appendFile(/*turbopackIgnore: true*/ path.join(dir, "errors.log"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  } catch {}
}
