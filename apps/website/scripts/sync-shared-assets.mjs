// Syncs the shared @colibri-social/assets files into this app's public/ dir so
// Astro serves them at the site root (in both dev and build) — that's where the
// embedded client app's root-absolute asset URLs (/twemoji.woff2, /login/*.svg,
// /logo.png, ...) resolve from. The assets package remains the single source of
// truth; the copies here are gitignored (see public/.gitignore).
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assetsDir } from "@colibri-social/assets/node";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

cpSync(assetsDir, publicDir, { recursive: true });
console.log(`Synced shared assets from ${assetsDir} -> ${publicDir}`);
