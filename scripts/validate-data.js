import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDatabase, validateRows, isoDate } from "./data-utils.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const rows = validateRows(parseDatabase(await readFile(resolve(root, "db.js"), "utf8")), { requireCanonical: true, requireFullHistory: true });
  const status = JSON.parse(await readFile(resolve(root, "data-status.json"), "utf8"));
  if (!["ok", "error", "unknown"].includes(status.status)) throw new Error("Invalid update status");
  if (status.latestDrawDate !== isoDate(rows[0][0]) || status.totalDraws !== rows.length) throw new Error("Data status does not match the saved draw dataset");
  for (const field of ["sourceName", "sourceUrl", "message"]) if (typeof status[field] !== "string") throw new Error(`Invalid status field: ${field}`);
  for (const field of ["lastAttemptAt", "lastSuccessAt"]) if (status[field] !== null && (typeof status[field] !== "string" || !Number.isFinite(Date.parse(status[field])))) throw new Error(`Invalid status timestamp: ${field}`);
  if (status.status === "ok" && !status.lastSuccessAt) throw new Error("Successful update needs a success timestamp");
  console.log(`Validated ${rows.length} weekly draws, ${isoDate(rows.at(-1)[0])} to ${isoDate(rows[0][0])}. Update status: ${status.status}.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
