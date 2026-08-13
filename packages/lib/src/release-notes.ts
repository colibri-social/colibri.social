export type ReleaseNoteKind = "feature" | "fix";

export const RELEASE_NOTE_KINDS: Array<ReleaseNoteKind> = ["feature", "fix"];

export type ReleasePlatform =
	| "web"
	| "ios"
	| "android"
	| "macos"
	| "windows"
	| "linux";

export const RELEASE_PLATFORMS: Array<ReleasePlatform> = [
	"web",
	"ios",
	"android",
	"macos",
	"windows",
	"linux",
];

export type PlatformGroup = "all" | "mobile" | "desktop";

export const PLATFORM_GROUPS: Record<PlatformGroup, Array<ReleasePlatform>> = {
	all: RELEASE_PLATFORMS,
	mobile: ["ios", "android"],
	desktop: ["macos", "windows", "linux"],
};

export type PlatformSelector = ReleasePlatform | PlatformGroup;

export const PLATFORM_SELECTORS: Array<PlatformSelector> = [
	...RELEASE_PLATFORMS,
	"all",
	"mobile",
	"desktop",
];

export interface ReleaseNoteEntry {
	title: string;
	body: string;
	icon: string;
	kind: ReleaseNoteKind;
	platforms: Array<ReleasePlatform>;
}

export interface ReleaseNote {
	version: string;
	date: string;
	title?: string;
	heroImage?: string;
	entries: Array<ReleaseNoteEntry>;
}

export interface WhatsNewBlock {
	title: string;
	icon: string;
	body: string;
	platforms: Array<ReleasePlatform>;
	kind?: ReleaseNoteKind;
	releaseTitle?: string;
	heroImage?: string;
}

export interface ChangesetRelease {
	name: string;
	type: string;
}

export interface ParsedChangeset {
	releases: Array<ChangesetRelease>;
	summary: string;
	block?: WhatsNewBlock;
}

export class WhatsNewError extends Error {}

const BLOCK_PATTERN = /<!--[ \t]*whatsnew\b([\s\S]*?)-->/;
const FRONTMATTER_PATTERN = /\s*---([\s\S]*?)\n\s*---(\s*(?:\n|$)[\s\S]*)/;
const KEY_LINE_PATTERN = /^([A-Za-z][A-Za-z0-9]*):[ \t]*(.*)$/;
const FRONTMATTER_LINE_PATTERN =
	/^\s*["']?([^"':]+?)["']?\s*:\s*([A-Za-z]+)\s*$/;

const ENTRY_KEYS = ["title", "icon", "body"] as const;
const REQUIRED_KEYS: Array<string> = [...ENTRY_KEYS, "platforms"];
const OPTIONAL_KEYS = ["kind", "releaseTitle", "heroImage"] as const;
const KNOWN_KEYS: Array<string> = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

const parseFields = (source: string): Map<string, string> => {
	const fields = new Map<string, string>();
	let current: string | undefined;

	for (const line of source.split("\n")) {
		if (line.trim() === "") {
			current = undefined;
			continue;
		}

		const isContinuation = /^[ \t]/.test(line);
		const match = isContinuation ? null : KEY_LINE_PATTERN.exec(line);

		if (match) {
			const [, key, value] = match;
			if (fields.has(key)) {
				throw new WhatsNewError(`duplicate key "${key}" in What's New block`);
			}
			current = key;
			fields.set(key, value.trim());
			continue;
		}

		if (!current) {
			throw new WhatsNewError(
				`expected "key: value" in What's New block, got: ${line.trim()}`,
			);
		}

		fields.set(current, `${fields.get(current) ?? ""} ${line.trim()}`.trim());
	}

	return fields;
};

export const isReleasePlatform = (value: string): value is ReleasePlatform =>
	(RELEASE_PLATFORMS as Array<string>).includes(value);

const isPlatformGroup = (value: string): value is PlatformGroup =>
	value in PLATFORM_GROUPS;

export const parsePlatforms = (raw: string): Array<ReleasePlatform> => {
	const tokens = raw
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter((token) => token !== "");

	if (tokens.length === 0) {
		throw new WhatsNewError(
			'"platforms" is empty in What\'s New block, list at least one platform',
		);
	}

	const selected = new Set<ReleasePlatform>();

	for (const token of tokens) {
		if (isPlatformGroup(token)) {
			for (const platform of PLATFORM_GROUPS[token]) selected.add(platform);
			continue;
		}

		if (isReleasePlatform(token)) {
			selected.add(token);
			continue;
		}

		throw new WhatsNewError(
			`unknown platform "${token}" in What's New block, expected one of ${PLATFORM_SELECTORS.join(", ")}`,
		);
	}

	return RELEASE_PLATFORMS.filter((platform) => selected.has(platform));
};

export const matchesPlatform = (
	entry: Pick<ReleaseNoteEntry, "platforms">,
	platform: ReleasePlatform,
): boolean => entry.platforms.includes(platform);

export const filterEntriesForPlatform = <
	T extends Pick<ReleaseNoteEntry, "platforms">,
>(
	entries: ReadonlyArray<T>,
	platform: ReleasePlatform,
): Array<T> => entries.filter((entry) => matchesPlatform(entry, platform));

export const extractWhatsNewBlock = (
	summary: string,
): WhatsNewBlock | undefined => {
	const match = BLOCK_PATTERN.exec(summary);
	if (!match) return undefined;

	const fields = parseFields(match[1]);

	for (const key of fields.keys()) {
		if (!KNOWN_KEYS.includes(key)) {
			throw new WhatsNewError(
				`unknown key "${key}" in What's New block, expected one of ${KNOWN_KEYS.join(", ")}`,
			);
		}
	}

	for (const key of REQUIRED_KEYS) {
		if (fields.get(key)) continue;

		throw new WhatsNewError(
			key === "platforms"
				? 'What\'s New block is missing "platforms", add for example "platforms: all"'
				: `What's New block is missing "${key}"`,
		);
	}

	const block: WhatsNewBlock = {
		title: fields.get("title") as string,
		icon: fields.get("icon") as string,
		body: fields.get("body") as string,
		platforms: parsePlatforms(fields.get("platforms") as string),
	};

	const kind = fields.get("kind");
	if (kind) {
		if (!RELEASE_NOTE_KINDS.includes(kind as ReleaseNoteKind)) {
			throw new WhatsNewError(
				`unknown kind "${kind}" in What's New block, expected ${RELEASE_NOTE_KINDS.join(" or ")}`,
			);
		}
		block.kind = kind as ReleaseNoteKind;
	}

	const releaseTitle = fields.get("releaseTitle");
	if (releaseTitle) block.releaseTitle = releaseTitle;

	const heroImage = fields.get("heroImage");
	if (heroImage) block.heroImage = heroImage;

	return block;
};

export const parseChangesetFile = (contents: string): ParsedChangeset => {
	const match = FRONTMATTER_PATTERN.exec(contents);
	if (!match) {
		throw new WhatsNewError("changeset is missing frontmatter");
	}

	const [, frontmatter, rest] = match;
	const releases: Array<ChangesetRelease> = [];

	for (const line of frontmatter.split("\n")) {
		if (line.trim() === "") continue;
		const release = FRONTMATTER_LINE_PATTERN.exec(line);
		if (!release) continue;
		releases.push({ name: release[1], type: release[2] });
	}

	const summary = rest.trim();
	return { releases, summary, block: extractWhatsNewBlock(summary) };
};

export interface WhatsNewFields {
	title: string;
	icon: string;
	body: string;
	platforms: Array<PlatformSelector>;
	kind?: ReleaseNoteKind;
}

export const serializeWhatsNewBlock = (fields: WhatsNewFields): string => {
	const value = (raw: string) =>
		raw
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "")
			.join("\n  ");

	const lines = [
		"<!-- whatsnew",
		`title: ${value(fields.title)}`,
		`icon: ${value(fields.icon)}`,
		`body: ${value(fields.body)}`,
		`platforms: ${fields.platforms.join(", ")}`,
	];

	if (fields.kind) lines.push(`kind: ${fields.kind}`);
	lines.push("-->");

	return lines.join("\n");
};

export const appendWhatsNewBlock = (
	contents: string,
	fields: WhatsNewFields,
): string => `${contents.trimEnd()}\n\n${serializeWhatsNewBlock(fields)}\n`;

export const kindForBump = (bump: string): ReleaseNoteKind =>
	bump === "patch" ? "fix" : "feature";
