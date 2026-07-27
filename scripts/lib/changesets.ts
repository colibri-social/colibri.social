import { readdir, readFile } from "node:fs/promises";
import type { ParsedChangeset } from "../../packages/lib/src/release-notes.ts";
import { parseChangesetFile } from "../../packages/lib/src/release-notes.ts";

export const CLIENT_PACKAGE = "@colibri-social/client";
export const CHANGESET_DIR = new URL("../../.changeset/", import.meta.url);

export const listChangesetFiles = async (): Promise<Array<string>> => {
	const files = await readdir(CHANGESET_DIR);
	return files
		.filter((file) => file.endsWith(".md"))
		.filter((file) => !file.startsWith("."))
		.filter((file) => file.toLowerCase() !== "readme.md")
		.sort();
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
