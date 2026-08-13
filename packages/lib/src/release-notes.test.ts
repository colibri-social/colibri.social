import { describe, expect, it } from "vitest";
import {
	appendWhatsNewBlock,
	extractWhatsNewBlock,
	filterEntriesForPlatform,
	isReleasePlatform,
	kindForBump,
	matchesPlatform,
	parseChangesetFile,
	RELEASE_PLATFORMS,
	serializeWhatsNewBlock,
	WhatsNewError,
} from "./release-notes.js";

const changeset = (summary: string, bump = "minor") =>
	`---\n"@colibri-social/client": ${bump}\n---\n\n${summary}\n`;

const platformsOf = (raw: string) =>
	extractWhatsNewBlock(
		[
			"<!-- whatsnew",
			"title: Voice channels",
			"icon: microphone",
			"body: Hop in.",
			`platforms: ${raw}`,
			"-->",
		].join("\n"),
	)?.platforms;

describe("extractWhatsNewBlock", () => {
	it("returns undefined when there is no block", () => {
		expect(extractWhatsNewBlock("Adds voice channels")).toBeUndefined();
	});

	it("reads a well-formed block", () => {
		const block = extractWhatsNewBlock(
			[
				"Adds voice channels",
				"",
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop into a voice channel.",
				"platforms: all",
				"-->",
			].join("\n"),
		);

		expect(block).toEqual({
			title: "Voice channels",
			icon: "microphone",
			body: "Hop into a voice channel.",
			platforms: RELEASE_PLATFORMS,
		});
	});

	it("joins indented continuation lines into one value", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop into a voice channel",
				"  and talk without leaving",
				"  the app.",
				"platforms: all",
				"-->",
			].join("\n"),
		);

		expect(block?.body).toBe(
			"Hop into a voice channel and talk without leaving the app.",
		);
	});

	it("keeps colons inside values", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Voice: now with video",
				"icon: microphone",
				"body: See https://colibri.social for details.",
				"platforms: all",
				"-->",
			].join("\n"),
		);

		expect(block?.title).toBe("Voice: now with video");
		expect(block?.body).toBe("See https://colibri.social for details.");
	});

	it("reads an explicit kind", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Smoother swiping",
				"icon: hand-swipe-right",
				"body: Swipe gestures feel sharper.",
				"platforms: all",
				"kind: fix",
				"-->",
			].join("\n"),
		);

		expect(block?.kind).toBe("fix");
	});

	it("leaves kind undefined when it is not given", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop in.",
				"platforms: all",
				"-->",
			].join("\n"),
		);

		expect(block?.kind).toBeUndefined();
	});

	it("rejects an unknown kind", () => {
		expect(() =>
			extractWhatsNewBlock(
				[
					"<!-- whatsnew",
					"title: Voice channels",
					"icon: microphone",
					"body: Hop in.",
					"platforms: all",
					"kind: improvement",
					"-->",
				].join("\n"),
			),
		).toThrow(/unknown kind "improvement"/);
	});

	it("reads the optional release-level keys", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop in.",
				"platforms: all",
				"releaseTitle: Voice and video",
				"heroImage: voice-banner",
				"-->",
			].join("\n"),
		);

		expect(block?.releaseTitle).toBe("Voice and video");
		expect(block?.heroImage).toBe("voice-banner");
	});

	for (const missing of ["title", "icon", "body", "platforms"]) {
		it(`rejects a block missing "${missing}"`, () => {
			const lines = [
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop in.",
				"platforms: all",
				"-->",
			].filter((line) => !line.startsWith(`${missing}:`));

			expect(() => extractWhatsNewBlock(lines.join("\n"))).toThrow(
				WhatsNewError,
			);
		});
	}

	it("names platforms in the message when it is missing", () => {
		expect(() =>
			extractWhatsNewBlock(
				[
					"<!-- whatsnew",
					"title: Voice channels",
					"icon: microphone",
					"body: Hop in.",
					"-->",
				].join("\n"),
			),
		).toThrow(/missing "platforms"/);
	});

	it("rejects an unknown key", () => {
		expect(() =>
			extractWhatsNewBlock(
				[
					"<!-- whatsnew",
					"title: Voice channels",
					"icon: microphone",
					"body: Hop in.",
					"platforms: all",
					"tilte: typo",
					"-->",
				].join("\n"),
			),
		).toThrow(/unknown key "tilte"/);
	});

	it("rejects a duplicate key", () => {
		expect(() =>
			extractWhatsNewBlock(
				[
					"<!-- whatsnew",
					"title: Voice channels",
					"title: Voice channels again",
					"icon: microphone",
					"body: Hop in.",
					"platforms: all",
					"-->",
				].join("\n"),
			),
		).toThrow(/duplicate key "title"/);
	});

	it("rejects a stray line that is not a key or a continuation", () => {
		expect(() =>
			extractWhatsNewBlock(
				["<!-- whatsnew", "just some prose", "-->"].join("\n"),
			),
		).toThrow(WhatsNewError);
	});
});

describe("platforms", () => {
	it("expands all to every platform", () => {
		expect(platformsOf("all")).toEqual(RELEASE_PLATFORMS);
	});

	it("expands the mobile and desktop shorthands", () => {
		expect(platformsOf("mobile")).toEqual(["ios", "android"]);
		expect(platformsOf("desktop")).toEqual(["macos", "windows", "linux"]);
	});

	it("reads a plain list", () => {
		expect(platformsOf("ios, android")).toEqual(["ios", "android"]);
	});

	it("combines a shorthand with a concrete platform", () => {
		expect(platformsOf("mobile, macos")).toEqual(["ios", "android", "macos"]);
	});

	it("orders the result canonically whatever the input order", () => {
		expect(platformsOf("linux, web, ios")).toEqual(["web", "ios", "linux"]);
	});

	it("dedupes a shorthand overlapping its own members", () => {
		expect(platformsOf("mobile, ios")).toEqual(["ios", "android"]);
		expect(platformsOf("all, windows")).toEqual(RELEASE_PLATFORMS);
	});

	it("tolerates casing and stray whitespace", () => {
		expect(platformsOf("  IOS ,android ")).toEqual(["ios", "android"]);
	});

	it("reads a list wrapped onto continuation lines", () => {
		const block = extractWhatsNewBlock(
			[
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop in.",
				"platforms: web,",
				"  ios",
				"-->",
			].join("\n"),
		);

		expect(block?.platforms).toEqual(["web", "ios"]);
	});

	it("rejects an unknown platform", () => {
		expect(() => platformsOf("windwos")).toThrow(/unknown platform "windwos"/);
	});

	it("rejects a list of nothing but separators", () => {
		expect(() => platformsOf(",")).toThrow(WhatsNewError);
	});
});

describe("matchesPlatform", () => {
	const entry = (platforms: Array<"web" | "ios" | "android">) => ({
		platforms,
	});

	it("matches a listed platform and nothing else", () => {
		expect(matchesPlatform(entry(["ios", "android"]), "ios")).toBe(true);
		expect(matchesPlatform(entry(["ios", "android"]), "web")).toBe(false);
	});

	it("keeps matching entries in order and drops the rest", () => {
		const entries = [
			{ id: "a", platforms: ["ios" as const] },
			{ id: "b", platforms: ["web" as const] },
			{ id: "c", platforms: ["web" as const, "ios" as const] },
		];

		expect(
			filterEntriesForPlatform(entries, "ios").map((item) => item.id),
		).toEqual(["a", "c"]);
		expect(filterEntriesForPlatform(entries, "macos")).toEqual([]);
	});
});

describe("isReleasePlatform", () => {
	it("accepts every concrete platform", () => {
		for (const platform of RELEASE_PLATFORMS) {
			expect(isReleasePlatform(platform)).toBe(true);
		}
	});

	it("rejects the shorthands and anything else", () => {
		expect(isReleasePlatform("all")).toBe(false);
		expect(isReleasePlatform("mobile")).toBe(false);
		expect(isReleasePlatform("desktop")).toBe(false);
		expect(isReleasePlatform("")).toBe(false);
		expect(isReleasePlatform("iphone")).toBe(false);
	});
});

describe("parseChangesetFile", () => {
	it("reads the frontmatter releases and the summary", () => {
		const parsed = parseChangesetFile(changeset("Adds voice channels"));

		expect(parsed.releases).toEqual([
			{ name: "@colibri-social/client", type: "minor" },
		]);
		expect(parsed.summary).toBe("Adds voice channels");
		expect(parsed.block).toBeUndefined();
	});

	it("reads multiple releases", () => {
		const parsed = parseChangesetFile(
			'---\n"@colibri-social/client": patch\n"@colibri-social/assets": patch\n---\n\nA fix\n',
		);

		expect(parsed.releases.map((release) => release.name)).toEqual([
			"@colibri-social/client",
			"@colibri-social/assets",
		]);
	});

	it("reads the block alongside the summary", () => {
		const parsed = parseChangesetFile(
			changeset(
				[
					"Adds voice channels",
					"",
					"<!-- whatsnew",
					"title: Voice channels",
					"icon: microphone",
					"body: Hop in.",
					"platforms: all",
					"-->",
				].join("\n"),
			),
		);

		expect(parsed.block?.title).toBe("Voice channels");
	});

	it("keeps a horizontal rule in the summary rather than treating it as frontmatter", () => {
		const parsed = parseChangesetFile(
			changeset("Adds voice channels\n\n---\n\nMore detail"),
		);

		expect(parsed.summary).toContain("---");
		expect(parsed.summary).toContain("More detail");
		expect(parsed.releases).toEqual([
			{ name: "@colibri-social/client", type: "minor" },
		]);
	});

	it("throws when frontmatter is missing", () => {
		expect(() => parseChangesetFile("Adds voice channels")).toThrow(
			WhatsNewError,
		);
	});
});

describe("serializeWhatsNewBlock", () => {
	it("round trips through the parser", () => {
		const fields = {
			title: "Voice: now with video",
			icon: "microphone",
			body: "Hop into a voice channel and talk without leaving the app.",
			platforms: ["all" as const],
		};

		expect(extractWhatsNewBlock(serializeWhatsNewBlock(fields))).toEqual({
			...fields,
			platforms: RELEASE_PLATFORMS,
		});
	});

	it("round trips an explicit kind", () => {
		const fields = {
			title: "Smoother swiping",
			icon: "hand-swipe-right",
			body: "Swipe gestures feel sharper.",
			platforms: ["all" as const],
			kind: "fix" as const,
		};

		expect(extractWhatsNewBlock(serializeWhatsNewBlock(fields))).toEqual({
			...fields,
			platforms: RELEASE_PLATFORMS,
		});
	});

	it("round trips a narrowed platform list", () => {
		const fields = {
			title: "Resizable sidebar",
			icon: "sidebar",
			body: "Drag the edge of the channel sidebar.",
			platforms: ["macos" as const, "windows" as const, "linux" as const],
		};

		const serialized = serializeWhatsNewBlock(fields);
		expect(serialized).toContain("platforms: macos, windows, linux");
		expect(extractWhatsNewBlock(serialized)?.platforms).toEqual([
			"macos",
			"windows",
			"linux",
		]);
	});

	it("writes the shorthand it was given rather than expanding it", () => {
		const serialized = serializeWhatsNewBlock({
			title: "Voice channels",
			icon: "microphone",
			body: "Hop in.",
			platforms: ["all"],
		});

		expect(serialized).toContain("platforms: all");
	});

	it("round trips a multi-line body as continuation lines", () => {
		const fields = {
			title: "Voice channels",
			icon: "microphone",
			body: "Hop into a voice channel\nand talk without leaving the app.",
			platforms: ["all" as const],
		};

		const block = extractWhatsNewBlock(serializeWhatsNewBlock(fields));
		expect(block?.body).toBe(
			"Hop into a voice channel and talk without leaving the app.",
		);
	});
});

describe("kindForBump", () => {
	it("treats patch as a fix and everything else as a feature", () => {
		expect(kindForBump("patch")).toBe("fix");
		expect(kindForBump("minor")).toBe("feature");
		expect(kindForBump("major")).toBe("feature");
	});
});

describe("appendWhatsNewBlock", () => {
	it("appends a parseable block to an existing changeset", () => {
		const appended = appendWhatsNewBlock(changeset("Adds voice channels"), {
			title: "Voice channels",
			icon: "microphone",
			body: "Hop in.",
			platforms: ["all"],
		});

		const parsed = parseChangesetFile(appended);
		expect(parsed.summary.startsWith("Adds voice channels")).toBe(true);
		expect(parsed.block?.icon).toBe("microphone");
		expect(parsed.block?.platforms).toEqual(RELEASE_PLATFORMS);
	});
});
