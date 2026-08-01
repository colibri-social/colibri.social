import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { ReleaseNote } from "../packages/lib/src/release-notes.ts";

const PREVIEW_VERSION = "0.0.0-preview";

const DATA_FILE = new URL(
	"../packages/client/src/release-notes/data.ts",
	import.meta.url,
);

const flags = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
	const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
	if (match) flags.set(match[1], match[2] ?? "");
}

const version = flags.get("version")?.replace(/^v/, "").trim();
const max = Number(flags.get("max") ?? 0);
const out = flags.get("out");
const strict = flags.has("strict");

if (!version) {
	console.error(
		"usage: render-release-notes.ts --version=<release-version> [--max=<chars>] [--out=<path>] [--strict]",
	);
	process.exit(1);
}

const readNotes = async (): Promise<Array<ReleaseNote>> => {
	if (!existsSync(DATA_FILE)) return [];
	const module = await import(DATA_FILE.href);
	return (module.RELEASE_NOTES ?? []) as Array<ReleaseNote>;
};

const notes = (await readNotes()).filter(
	(note) => note.version !== PREVIEW_VERSION,
);

const exact = notes.find((entry) => entry.version === version);

if (strict && (!exact || exact.entries.length === 0)) {
	console.error(
		`no release notes for ${version}, and --strict forbids falling back to another version`,
	);
	process.exit(1);
}

const note = exact ?? notes[0];

if (!note || note.entries.length === 0) {
	console.error(
		`no release notes found for ${version}, and no newer entry to fall back to`,
	);
	process.exit(1);
}

if (note.version !== version) {
	console.error(
		`no release notes for ${version}, falling back to ${note.version}`,
	);
}

const lines = note.entries.map((entry) => {
	const body = entry.body.trim().replace(/\s+/g, " ");
	const title = entry.title.trim();
	return body ? `- ${title}: ${body}` : `- ${title}`;
});

const join = (parts: Array<string>) => parts.join("\n");

let text = join(lines);
if (max > 0 && text.length > max) {
	const kept: Array<string> = [];
	for (const line of lines) {
		if (join([...kept, line]).length > max) break;
		kept.push(line);
	}
	if (kept.length === 0) kept.push(`${lines[0].slice(0, Math.max(0, max - 1))}…`);
	text = join(kept);
	console.error(
		`trimmed release notes to ${kept.length} of ${lines.length} entries to fit ${max} characters`,
	);
}

if (out) {
	await writeFile(out, `${text}\n`);
	console.error(`wrote ${text.length} characters to ${out}`);
} else {
	console.log(text);
}
