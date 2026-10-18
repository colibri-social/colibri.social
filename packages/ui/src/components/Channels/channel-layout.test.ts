import { describe, expect, it } from "vitest";
import {
	type ChannelLayout,
	edgeChannel,
	findChannel,
	placeCategory,
	placeChannel,
	positionText,
	reconcileLayout,
	sameLayout,
	stepChannel,
} from "./channel-layout";

const layout: ChannelLayout = {
	uncategorized: ["rules"],
	categories: [
		{ id: "text", channels: ["general", "photos", "files"] },
		{ id: "empty", channels: [] },
		{ id: "voice", channels: ["lounge", "call"] },
	],
};

describe("placeChannel", () => {
	it("moves a channel within its category", () => {
		const next = placeChannel(layout, "general", {
			categoryId: "text",
			index: 2,
		});
		expect(next.categories[0].channels).toEqual(["photos", "files", "general"]);
	});

	it("moves a channel across categories", () => {
		const next = placeChannel(layout, "photos", {
			categoryId: "voice",
			index: 1,
		});
		expect(next.categories[0].channels).toEqual(["general", "files"]);
		expect(next.categories[2].channels).toEqual(["lounge", "photos", "call"]);
	});

	it("fills an empty category and moves channels out of categories", () => {
		const filled = placeChannel(layout, "files", {
			categoryId: "empty",
			index: 0,
		});
		expect(filled.categories[1].channels).toEqual(["files"]);
		const loose = placeChannel(filled, "files", {
			categoryId: null,
			index: 0,
		});
		expect(loose.uncategorized).toEqual(["files", "rules"]);
		expect(loose.categories[1].channels).toEqual([]);
	});

	it("clamps the index and leaves the source untouched", () => {
		const next = placeChannel(layout, "rules", {
			categoryId: "text",
			index: 99,
		});
		expect(next.categories[0].channels.at(-1)).toBe("rules");
		expect(layout.uncategorized).toEqual(["rules"]);
	});
});

describe("placeCategory", () => {
	it("reorders categories and keeps their channels", () => {
		const next = placeCategory(layout, "voice", 0);
		expect(next.categories.map((category) => category.id)).toEqual([
			"voice",
			"text",
			"empty",
		]);
		expect(next.categories[0].channels).toEqual(["lounge", "call"]);
	});

	it("ignores unknown categories", () => {
		expect(placeCategory(layout, "missing", 0)).toBe(layout);
	});
});

describe("stepChannel", () => {
	it("steps within a category", () => {
		expect(stepChannel(layout, "general", 1)).toEqual({
			categoryId: "text",
			index: 1,
		});
	});

	it("crosses into the next category at its start", () => {
		expect(stepChannel(layout, "files", 1)).toEqual({
			categoryId: "empty",
			index: 0,
		});
	});

	it("crosses into the previous group at its end", () => {
		expect(stepChannel(layout, "lounge", -1)).toEqual({
			categoryId: "empty",
			index: 0,
		});
		expect(stepChannel(layout, "general", -1)).toEqual({
			categoryId: null,
			index: 1,
		});
	});

	it("stops at both ends of the list", () => {
		expect(stepChannel(layout, "rules", -1)).toBeUndefined();
		expect(stepChannel(layout, "call", 1)).toBeUndefined();
	});

	it("walks every slot exactly once", () => {
		let current = layout;
		const visited: string[] = [];
		for (;;) {
			const slot = stepChannel(current, "rules", 1);
			if (!slot) break;
			current = placeChannel(current, "rules", slot);
			visited.push(`${slot.categoryId}:${slot.index}`);
		}
		expect(visited).toEqual([
			"text:0",
			"text:1",
			"text:2",
			"text:3",
			"empty:0",
			"voice:0",
			"voice:1",
			"voice:2",
		]);
	});
});

describe("edgeChannel", () => {
	it("jumps to the ends of the current category", () => {
		expect(edgeChannel(layout, "photos", "start")).toEqual({
			categoryId: "text",
			index: 0,
		});
		expect(edgeChannel(layout, "photos", "end")).toEqual({
			categoryId: "text",
			index: 2,
		});
		expect(edgeChannel(layout, "general", "start")).toBeUndefined();
	});
});

describe("reconcileLayout", () => {
	it("keeps the candidate order for known ids", () => {
		const candidate = placeChannel(layout, "general", {
			categoryId: "voice",
			index: 0,
		});
		expect(sameLayout(reconcileLayout(candidate, layout), candidate)).toBe(
			true,
		);
	});

	it("drops removed ids and appends new ones to their real group", () => {
		const candidate = placeCategory(layout, "voice", 0);
		const actual: ChannelLayout = {
			uncategorized: ["rules", "welcome"],
			categories: [
				{ id: "text", channels: ["general", "files", "memes"] },
				{ id: "voice", channels: ["lounge", "call"] },
				{ id: "events", channels: [] },
			],
		};
		expect(reconcileLayout(candidate, actual)).toEqual({
			uncategorized: ["rules", "welcome"],
			categories: [
				{ id: "voice", channels: ["lounge", "call"] },
				{ id: "text", channels: ["general", "files", "memes"] },
				{ id: "events", channels: [] },
			],
		});
	});
});

describe("findChannel and positionText", () => {
	it("finds channels and describes positions", () => {
		expect(findChannel(layout, "call")).toEqual({
			categoryId: "voice",
			index: 1,
		});
		expect(findChannel(layout, "missing")).toBeUndefined();
		expect(positionText(2, 5, "Text")).toBe("position 3 of 5 in Text");
		expect(positionText(0, 1)).toBe("position 1 of 1 outside any category");
	});
});
