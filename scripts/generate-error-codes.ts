import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LEXICON_DIR = "apps/website/src/utils/atproto/lexicons/generated";
const OUT_FILE = "packages/client/src/errors/appview-codes.ts";

interface LexiconError {
	name?: unknown;
	description?: unknown;
}

interface LexiconDoc {
	id?: unknown;
	defs?: { main?: { errors?: unknown } };
}

const collect = async (): Promise<{
	descriptions: Map<string, string>;
	byMethod: Map<string, Array<string>>;
}> => {
	const files = (await readdir(LEXICON_DIR))
		.filter((name) => name.endsWith(".json") && name !== "manifest.json")
		.sort();

	const descriptions = new Map<string, string>();
	const byMethod = new Map<string, Array<string>>();

	for (const file of files) {
		const raw = await readFile(join(LEXICON_DIR, file), "utf8");
		const doc = JSON.parse(raw) as LexiconDoc;
		const id = typeof doc.id === "string" ? doc.id : undefined;
		const errors = doc.defs?.main?.errors;
		if (!id || !Array.isArray(errors)) continue;

		const names: Array<string> = [];
		for (const entry of errors as Array<LexiconError>) {
			if (typeof entry.name !== "string") continue;
			names.push(entry.name);
			if (!descriptions.has(entry.name)) {
				descriptions.set(
					entry.name,
					typeof entry.description === "string" ? entry.description : "",
				);
			}
		}
		if (names.length > 0) byMethod.set(id, names.sort());
	}

	return { descriptions, byMethod };
};

const render = (
	descriptions: Map<string, string>,
	byMethod: Map<string, Array<string>>,
): string => {
	const codes = [...descriptions.keys()].sort();

	const union = codes.map((code) => `\t| "${code}"`).join("\n");

	const describeEntries = codes
		.map((code) => `\t${code}: ${JSON.stringify(descriptions.get(code) ?? "")},`)
		.join("\n");

	const methodEntries = [...byMethod.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([id, names]) => {
			const list = names.map((name) => `"${name}"`).join(", ");
			return `\t"${id}": [${list}],`;
		})
		.join("\n");

	return `export type AppViewErrorCode =
${union};

export const APPVIEW_CODE_DESCRIPTIONS: Record<AppViewErrorCode, string> = {
${describeEntries}
};

export const APPVIEW_METHOD_ERRORS: Record<
	string,
	ReadonlyArray<AppViewErrorCode>
> = {
${methodEntries}
};

export const isAppViewErrorCode = (value: string): value is AppViewErrorCode =>
	value in APPVIEW_CODE_DESCRIPTIONS;
`;
};

const main = async (): Promise<void> => {
	const { descriptions, byMethod } = await collect();
	if (descriptions.size === 0) {
		throw new Error(
			`No error codes found in ${LEXICON_DIR}. Run \`pnpm lexicons:export\` first.`,
		);
	}
	await writeFile(OUT_FILE, render(descriptions, byMethod), "utf8");
	console.log(
		`Wrote ${descriptions.size} error codes across ${byMethod.size} methods to ${OUT_FILE}`,
	);
};

await main();
