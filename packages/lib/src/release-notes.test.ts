import { describe, expect, it } from "vitest";
import {
	appendWhatsNewBlock,
	extractWhatsNewBlock,
	kindForBump,
	parseChangesetFile,
	serializeWhatsNewBlock,
	WhatsNewError,
} from "./release-notes.js";

const changeset = (summary: string, bump = "minor") =>
	`---\n"@colibri-social/client": ${bump}\n---\n\n${summary}\n`;

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
				"-->",
			].join("\n"),
		);

		expect(block).toEqual({
			title: "Voice channels",
			icon: "microphone",
			body: "Hop into a voice channel.",
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
				"releaseTitle: Voice and video",
				"heroImage: voice-banner",
				"-->",
			].join("\n"),
		);

		expect(block?.releaseTitle).toBe("Voice and video");
		expect(block?.heroImage).toBe("voice-banner");
	});

	for (const missing of ["title", "icon", "body"]) {
		it(`rejects a block missing "${missing}"`, () => {
			const lines = [
				"<!-- whatsnew",
				"title: Voice channels",
				"icon: microphone",
				"body: Hop in.",
				"-->",
			].filter((line) => !line.startsWith(`${missing}:`));

			expect(() => extractWhatsNewBlock(lines.join("\n"))).toThrow(
				WhatsNewError,
			);
		});
	}

	it("rejects an unknown key", () => {
		expect(() =>
			extractWhatsNewBlock(
				[
					"<!-- whatsnew",
					"title: Voice channels",
					"icon: microphone",
					"body: Hop in.",
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
		};

		expect(extractWhatsNewBlock(serializeWhatsNewBlock(fields))).toEqual(
			fields,
		);
	});

	it("round trips an explicit kind", () => {
		const fields = {
			title: "Smoother swiping",
			icon: "hand-swipe-right",
			body: "Swipe gestures feel sharper.",
			kind: "fix" as const,
		};

		expect(extractWhatsNewBlock(serializeWhatsNewBlock(fields))).toEqual(
			fields,
		);
	});

	it("round trips a multi-line body as continuation lines", () => {
		const fields = {
			title: "Voice channels",
			icon: "microphone",
			body: "Hop into a voice channel\nand talk without leaving the app.",
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
		});

		const parsed = parseChangesetFile(appended);
		expect(parsed.summary.startsWith("Adds voice channels")).toBe(true);
		expect(parsed.block?.icon).toBe("microphone");
	});
});
