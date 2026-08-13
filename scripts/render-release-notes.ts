import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type {
	ReleaseNote,
	ReleaseNoteEntry,
	ReleasePlatform,
} from "../packages/lib/src/release-notes.ts";
import {
	filterEntriesForPlatform,
	isReleasePlatform,
	RELEASE_PLATFORMS,
} from "../packages/lib/src/release-notes.ts";

const PREVIEW_VERSION = "0.0.0-preview";
const GENERIC_NOTE = "Bug fixes and improvements.";

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
const platform = flags.get("platform")?.trim().toLowerCase();
const max = Number(flags.get("max") ?? 0);
const out = flags.get("out");
const strict = flags.has("strict");

const usage = `usage: render-release-notes.ts --version=<release-version> --platform=<${RELEASE_PLATFORMS.join("|")}> [--max=<chars>] [--out=<path>] [--strict]`;

if (!version) {
	console.error(usage);
	process.exit(1);
}

if (!platform) {
	console.error(`missing --platform\n${usage}`);
	process.exit(1);
}

if (!isReleasePlatform(platform)) {
	console.error(
		`unknown platform "${platform}", expected one of ${RELEASE_PLATFORMS.join(", ")}`,
	);
	process.exit(1);
}

type LegacyEntry = Omit<ReleaseNoteEntry, "platforms"> & {
	platforms?: Array<ReleasePlatform>;
};

type LegacyNote = Omit<ReleaseNote, "entries"> & {
	entries: Array<LegacyEntry>;
};

let widened = false;

const withPlatforms = (note: LegacyNote): ReleaseNote => ({
	...note,
	entries: note.entries.map((entry) => {
		if (entry.platforms) return { ...entry, platforms: entry.platforms };
		widened = true;
		return { ...entry, platforms: [...RELEASE_PLATFORMS] };
	}),
});

const readNotes = async (): Promise<Array<ReleaseNote>> => {
	if (!existsSync(DATA_FILE)) return [];
	const module = await import(DATA_FILE.href);
	const notes: Array<LegacyNote> = module.RELEASE_NOTES ?? [];
	return notes.map(withPlatforms);
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

if (widened) {
	console.error(
		"some entries declare no platforms, treating them as applying everywhere",
	);
}

const visible = filterEntriesForPlatform(note.entries, platform);

if (visible.length === 0 && strict) {
	console.error(
		`no ${platform} release notes for ${note.version}, and --strict forbids the generic fallback`,
	);
	process.exit(1);
}

if (visible.length === 0) {
	console.error(
		`no ${platform} release notes for ${note.version}, falling back to a generic line`,
	);
}

const lines =
	visible.length === 0
		? [GENERIC_NOTE]
		: visible.map((entry) => {
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
