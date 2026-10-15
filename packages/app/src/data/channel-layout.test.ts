import { describe, expect, it } from "vitest";
import {
	channelIdentity,
	normalizeChannelLayout,
	sameChannel,
} from "./channel-layout";
import type { CategoryView, ChannelView, SpaceRef } from "./types";

const COMMUNITY = "did:plc:space";
const text = (skey: string) =>
	`at://${COMMUNITY}/space/social.colibri.beta.channel.text/${skey}` as SpaceRef;
const voice = (skey: string) =>
	`at://${COMMUNITY}/space/social.colibri.beta.channel.voice/${skey}` as SpaceRef;

const channel = (
	space: SpaceRef,
	extra: Partial<ChannelView> = {},
): ChannelView => ({
	space,
	type: space.includes(".voice/")
		? "social.colibri.beta.channel.voice"
		: "social.colibri.beta.channel.text",
	name: space.split("/").pop() ?? "",
	viewer: {} as ChannelView["viewer"],
	...extra,
});

const category = (rkey: string, channels: ChannelView[]): CategoryView => ({
	rkey,
	name: rkey,
	channels,
});

const ids = (list: readonly ChannelView[] | undefined) =>
	(list ?? []).map((entry) => channelIdentity(entry.space));

describe("channel identity", () => {
	it("treats the same skey in the same Space as one channel", () => {
		expect(sameChannel(text("lounge"), voice("lounge"))).toBe(true);
		expect(sameChannel(text("lounge"), text("general"))).toBe(false);
	});
});

describe("normalizeChannelLayout", () => {
	it("places a channel listed in a category there and nowhere else", () => {
		const lounge = channel(voice("lounge"));
		const general = channel(text("general"));
		const layout = normalizeChannelLayout(
			[category("talk", [lounge])],
			[general, lounge],
		);
		expect(ids(layout.categories?.[0]?.channels)).toEqual([
			`${COMMUNITY}/lounge`,
		]);
		const uncategorized = layout.channels?.filter((entry) => !entry.category);
		expect(ids(uncategorized)).toEqual([`${COMMUNITY}/general`]);
		expect(layout.categories?.[0]?.channels[0]).toBe(
			layout.channels?.find((entry) => entry.space === lounge.space),
		);
	});

	it("keeps a channel that declares its category even when the order omits it", () => {
		const dev = channel(text("dev"), { category: "work" });
		const layout = normalizeChannelLayout([category("work", [])], [dev]);
		expect(ids(layout.categories?.[0]?.channels)).toEqual([`${COMMUNITY}/dev`]);
		expect(layout.channels?.[0]?.category).toBe("work");
	});

	it("drops duplicates across lists, categories and ref spellings", () => {
		const lounge = channel(voice("lounge"));
		const layout = normalizeChannelLayout(
			[
				category("talk", [lounge, channel(text("lounge"))]),
				category("other", [lounge]),
			],
			[lounge, channel(text("lounge")), lounge],
		);
		expect(layout.channels).toHaveLength(1);
		expect(ids(layout.categories?.[0]?.channels)).toEqual([
			`${COMMUNITY}/lounge`,
		]);
		expect(layout.categories?.[1]?.channels).toEqual([]);
	});

	it("ignores a declared category that no longer exists", () => {
		const dev = channel(text("dev"), { category: "gone" });
		const layout = normalizeChannelLayout([], [dev]);
		expect(layout.channels?.[0]?.category).toBeUndefined();
	});

	it("returns stable objects when nothing needs fixing", () => {
		const dev = channel(text("dev"), { category: "work" });
		const work = category("work", [dev]);
		const layout = normalizeChannelLayout([work], [dev]);
		expect(layout.categories?.[0]).toBe(work);
		expect(layout.channels?.[0]).toBe(dev);
	});
});
