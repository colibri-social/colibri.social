import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readColibriLexicons } from "./lexicon-source.ts";

const outDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"../src/utils/atproto/lexicons/generated",
);

const sha256 = (value: string) =>
	createHash("sha256").update(value).digest("hex");

const docs = await readColibriLexicons();

await mkdir(outDir, { recursive: true });

for (const stale of await readdir(outDir).catch(() => [])) {
	if (stale.endsWith(".json")) await rm(join(outDir, stale));
}

const manifest: Record<string, string> = {};

for (const doc of docs) {
	const json = `${JSON.stringify(doc, null, "\t")}\n`;
	manifest[doc.id] = sha256(json);
	await writeFile(join(outDir, `${doc.id}.json`), json, "utf8");
}

await writeFile(
	join(outDir, "manifest.json"),
	`${JSON.stringify({ count: docs.length, lexicons: manifest }, null, "\t")}\n`,
	"utf8",
);

console.info(
	`Exported ${docs.length} lexicons from @colibri-social/lexicons to ${outDir}`,
);
