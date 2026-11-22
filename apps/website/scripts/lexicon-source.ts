import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LexiconDoc } from "@atproto/lexicon";

const ANCHOR =
	"@colibri-social/lexicons/lexicons/social/colibri/community.json";

export function lexiconRoot(): string {
	return dirname(dirname(dirname(fileURLToPath(import.meta.resolve(ANCHOR)))));
}

async function jsonFilesIn(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await jsonFilesIn(path)));
		else if (entry.name.endsWith(".json")) files.push(path);
	}

	return files;
}

export async function readColibriLexicons(): Promise<LexiconDoc[]> {
	const root = join(lexiconRoot(), "social", "colibri");
	const files = await jsonFilesIn(root);
	const docs: LexiconDoc[] = [];

	for (const file of files) {
		const doc = JSON.parse(await readFile(file, "utf8")) as LexiconDoc;
		if (typeof doc.id !== "string" || !doc.id.startsWith("social.colibri.")) {
			throw new Error(`${file} is not a social.colibri lexicon`);
		}
		docs.push(doc);
	}

	return docs.sort((a, b) => a.id.localeCompare(b.id));
}
