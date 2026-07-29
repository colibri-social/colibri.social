import { readdir, readFile } from "node:fs/promises";
import type { ParsedChangeset } from "../../packages/lib/src/release-notes.ts";
import { parseChangesetFile } from "../../packages/lib/src/release-notes.ts";

export const CLIENT_PACKAGE = "@colibri-social/client";
export const CHANGESET_DIR = new URL("../../.changeset/", import.meta.url);

const PRE_FILE = new URL("pre.json", CHANGESET_DIR);

const listChangesetFiles = async (): Promise<Array<string>> => {
	const files = await readdir(CHANGESET_DIR);
	return files
		.filter((file) => file.endsWith(".md"))
		.filter((file) => !file.startsWith("."))
		.filter((file) => file.toLowerCase() !== "readme.md")
		.sort();
};

const changesetName = (file: string): string => file.replace(/\.md$/, "");

const releasedChangesets = async (): Promise<Set<string>> => {
	let contents: string;
	try {
		contents = await readFile(PRE_FILE, "utf8");
	} catch {
		return new Set();
	}

	try {
		const parsed = JSON.parse(contents) as { changesets?: Array<string> };
		return new Set(parsed.changesets ?? []);
	} catch {
		return new Set();
	}
};

export const listPendingChangesetFiles = async (): Promise<Array<string>> => {
	const [files, released] = await Promise.all([
		listChangesetFiles(),
		releasedChangesets(),
	]);
	return files.filter((file) => !released.has(changesetName(file)));
};

export interface LoadedChangeset extends ParsedChangeset {
	file: string;
}

export const readChangeset = async (file: string): Promise<LoadedChangeset> => {
	const contents = await readFile(new URL(file, CHANGESET_DIR), "utf8");
	return { file, ...parseChangesetFile(contents) };
};

export const clientBump = (
	changeset: ParsedChangeset,
): string | undefined =>
	changeset.releases.find((release) => release.name === CLIENT_PACKAGE)?.type;
