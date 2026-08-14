import { afterEach, describe, expect, it, vi } from "vitest";
import type { BadgeDefinition } from "../atproto/cache/schema";
import {
	appearanceStyle,
	badgeDefinitions,
	badgeDescription,
	badgeRank,
	badgeStyle,
	badgeText,
} from "./user-badges";

const badgeRankOrder = (): Array<string> =>
	[...badgeDefinitions().keys()]
		.reverse()
		.sort((a, b) => badgeRank(a) - badgeRank(b));

const withPublished = async (published: Array<BadgeDefinition>) => {
	vi.resetModules();
	vi.doMock("../atproto/labeler-badges", () => ({
		getLabelerBadgeDefinitions: () => Promise.resolve(published),
	}));
	const mod = await import("./user-badges");
	await mod.ensureBadgeDefinitions();
	return mod;
};

const PLAY_STORE_TESTER_BACKGROUND =
	"linear-gradient(90deg, color-mix(in srgb, #ff4d4d 18%, black), color-mix(in srgb, #ffcc00 18%, black), color-mix(in srgb, #22c55e 18%, black), color-mix(in srgb, #3b82f6 18%, black)) padding-box, linear-gradient(90deg, #ff4d4d, #ffcc00, #22c55e, #3b82f6) border-box";

describe("appearanceStyle", () => {
	it("fills a solid badge with its first colour", () => {
		expect(
			appearanceStyle({
				variant: "solid",
				colors: ["#8b5cf6"],
				foreground: "#fafafa",
			}),
		).toEqual({ "background-color": "#8b5cf6", color: "#fafafa" });
	});

	it("ignores colours past the first on a solid badge", () => {
		const style = appearanceStyle({
			variant: "solid",
			colors: ["#8b5cf6", "#ffffff"],
			foreground: "#fafafa",
		});

		expect(style?.["background-color"]).toBe("#8b5cf6");
	});

	it("layers a darkened fill under the border gradient", () => {
		expect(
			appearanceStyle({
				variant: "gradientBorder",
				colors: ["#ff4d4d", "#ffcc00", "#22c55e", "#3b82f6"],
				foreground: "#ffffff",
			}),
		).toEqual({
			background: PLAY_STORE_TESTER_BACKGROUND,
			color: "#ffffff",
		});
	});

	it("duplicates a lone stop so a single-colour gradient is still valid CSS", () => {
		const style = appearanceStyle({
			variant: "gradientBorder",
			colors: ["#ff4d4d"],
			foreground: "#ffffff",
		});

		expect(style?.background).toBe(
			"linear-gradient(90deg, color-mix(in srgb, #ff4d4d 18%, black), color-mix(in srgb, #ff4d4d 18%, black)) padding-box, linear-gradient(90deg, #ff4d4d, #ff4d4d) border-box",
		);
	});

	it("has no style for a badge without an appearance, leaving the neutral classes to apply", () => {
		expect(appearanceStyle(undefined)).toBeUndefined();
	});
});

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

describe("the bundled fallback catalogue", () => {
	it("covers every badge the labeler seeds", () => {
		expect([...badgeDefinitions().keys()].sort()).toEqual(
			[
				"backer-five",
				"bot",
				"donator",
				"play-store-tester",
				"sponsor-twenty-five",
				"supporter-ten",
				"team",
			].sort(),
		);
	});

	it("gives every bundled badge a renderable appearance", () => {
		for (const [val, definition] of badgeDefinitions()) {
			const appearance = definition.appearance;
			expect(appearance, val).toBeDefined();
			expect(["solid", "gradientBorder"], val).toContain(appearance?.variant);
			expect(appearance?.colors.length, val).toBeGreaterThan(0);
			for (const entry of appearance?.colors ?? []) {
				expect(entry, val).toMatch(HEX);
			}
			expect(appearance?.foreground, val).toMatch(HEX);
			expect(badgeStyle(val), val).toBeDefined();
		}
	});

	it("gives every bundled badge a name and a tooltip", () => {
		for (const val of badgeDefinitions().keys()) {
			expect(badgeText(val), val).not.toBe("");
			expect(badgeDescription(val), val).toBeTruthy();
		}
	});

	it("owns the bot badge itself, since the labeler never issues it", () => {
		expect(badgeText("bot")).toBe("BOT");
		expect(badgeDescription("bot")).toBe("Self-declared to be automated");
		expect(badgeStyle("bot")).toEqual({
			"background-color": "#fafafa",
			color: "#0a0a0a",
		});
	});

	it("orders the supporter tiers highest first, with bot last", () => {
		expect(badgeRankOrder()).toEqual([
			"team",
			"play-store-tester",
			"sponsor-twenty-five",
			"supporter-ten",
			"backer-five",
			"donator",
			"bot",
		]);
	});
});

describe("merging the published catalogue", () => {
	afterEach(() => {
		vi.doUnmock("../atproto/labeler-badges");
		vi.resetModules();
	});

	it("keeps the bundled colours for a record published before appearances existed", async () => {
		const bundled = {
			team: badgeStyle("team"),
			donator: badgeStyle("donator"),
			playStoreTester: badgeStyle("play-store-tester"),
		};

		const { badgeStyle: style, badgeText: text } = await withPublished([
			{
				identifier: "team",
				name: "CORE TEAM",
				description: "Official Colibri Maintainer",
				precedence: 0,
			},
			{
				identifier: "donator",
				name: "DONATOR",
				description: "Made a donation",
				precedence: 1,
			},
			{
				identifier: "play-store-tester",
				name: "PLAY STORE TESTER",
				description: "Helped test",
				precedence: 2,
			},
		]);

		expect(style("team")).toEqual(bundled.team);
		expect(style("donator")).toEqual(bundled.donator);
		expect(style("play-store-tester")).toEqual(bundled.playStoreTester);
		expect(text("team")).toBe("CORE TEAM");
	});

	it("prefers a published appearance over the bundled one", async () => {
		const { badgeStyle: style } = await withPublished([
			{
				identifier: "team",
				name: "TEAM",
				description: "",
				precedence: 0,
				appearance: {
					variant: "solid",
					colors: ["#0ea5e9"],
					foreground: "#00120a",
				},
			},
		]);

		expect(style("team")).toEqual({
			"background-color": "#0ea5e9",
			color: "#00120a",
		});
	});

	it("gives a brand new badge no inline colours when the record omits them", async () => {
		const { badgeStyle: style, badgeText: text } = await withPublished([
			{
				identifier: "translator",
				name: "TRANSLATOR",
				description: "Translated Colibri",
				precedence: 0,
			},
		]);

		expect(style("translator")).toBeUndefined();
		expect(text("translator")).toBe("TRANSLATOR");
	});

	it("stops styling a badge the record no longer lists", async () => {
		const { badgeStyle: style, badgeDescription: description } =
			await withPublished([
				{ identifier: "team", name: "TEAM", description: "", precedence: 0 },
			]);

		expect(style("donator")).toBeUndefined();
		expect(description("donator")).toBeUndefined();
	});

	it("keeps the client-local bot badge, which the labeler knows nothing about", async () => {
		const { badgeStyle: style, badgeText: text } = await withPublished([
			{ identifier: "team", name: "TEAM", description: "", precedence: 0 },
		]);

		expect(text("bot")).toBe("BOT");
		expect(style("bot")).toEqual({
			"background-color": "#fafafa",
			color: "#0a0a0a",
		});
	});
});

describe("an unrecognised label value", () => {
	it("falls back to a humanised name, no tooltip, and no inline colours", () => {
		expect(badgeText("early-adopter")).toBe("EARLY ADOPTER");
		expect(badgeDescription("early-adopter")).toBeUndefined();
		expect(badgeStyle("early-adopter")).toBeUndefined();
	});
});
