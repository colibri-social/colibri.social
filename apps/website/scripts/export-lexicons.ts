import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEXICON_DOCS } from "../src/utils/atproto/lexicons/index.ts";

const outDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"../src/utils/atproto/lexicons/generated",
);

const sha256 = (value: string) =>
	createHash("sha256").update(value).digest("hex");

await mkdir(outDir, { recursive: true });

for (const stale of await readdir(outDir).catch(() => [])) {
	if (stale.endsWith(".json")) await rm(join(outDir, stale));
}

const manifest: Record<string, string> = {};

for (const doc of [...LEXICON_DOCS].sort((a, b) => a.id.localeCompare(b.id))) {
	const json = `${JSON.stringify(doc, null, "\t")}\n`;
	manifest[doc.id] = sha256(json);
	await writeFile(join(outDir, `${doc.id}.json`), json, "utf8");
}

await writeFile(
	join(outDir, "manifest.json"),
	`${JSON.stringify({ count: LEXICON_DOCS.length, lexicons: manifest }, null, "\t")}\n`,
	"utf8",
);

console.info(`Exported ${LEXICON_DOCS.length} lexicons to ${outDir}`);
