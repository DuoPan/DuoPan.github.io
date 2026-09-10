import { readdir, mkdir, cp, stat, rm } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "_site");
if (relative(root, target) !== "_site") throw new Error("Build output must stay inside the repository's _site directory");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  const includeFile = entry.isFile() && (/\.(?:html|js|css|png|jpg|jpeg|webp|svg|ico|webmanifest)$/i.test(entry.name) || entry.name === "data-status.json");
  const includeDirectory = entry.isDirectory() && ["css", "assets", "images", "public"].includes(entry.name);
  if (includeFile || includeDirectory) await cp(resolve(root, entry.name), resolve(target, entry.name), { recursive: true });
}
await stat(resolve(target, "index.html"));
console.log("Static site prepared in _site.");
