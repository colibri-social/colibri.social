import { describe, expect, it } from "vitest";
import type {
	ChannelView,
	CommunityView,
	SpaceRef,
	ThreadView,
} from "../../../data/types";
import {
	type ForwardSpaceInput,
	type ForwardTarget,
	filterForwardGroups,
	forwardChannelList,
	forwardDestinationNoun,
	forwardGroups,
} from "./forward-targets";

const TEXT = "social.colibri.beta.channel.text";
const VOICE = "social.colibri.beta.channel.voice";
const THREAD = "social.colibri.beta.channel.thread";

const ref = (skey: string, type = TEXT) =>
	`at://did:plc:hq/space/${type}/${skey}` as SpaceRef;

const hq = {
	did: "did:plc:hq",
	name: "Colibri HQ",
} as unknown as CommunityView;

const channel = (
	skey: string,
	name: string,
	extra: { type?: string; canPost?: boolean; category?: string } = {},
) =>
	({
		space: ref(skey, extra.type ?? TEXT),
		type: extra.type ?? TEXT,
		name,
		category: extra.category,
		viewer: { canRead: true, canPost: extra.canPost ?? true },
	}) as unknown as ChannelView;

const thread = (
	skey: string,
	name: string,
	lastActivityAt: string,
	extra: { canPost?: boolean; closed?: boolean } = {},
) =>
	({
		space: ref(skey, THREAD),
		channel: ref("design"),
		name,
		lastActivityAt,
		...(extra.closed ? { closedAt: "2026-10-01T00:00:00.000Z" } : {}),
		viewer: { canPost: extra.canPost ?? true },
	}) as unknown as ThreadView;

const designThreads = [
	thread("icons", "Icon review", "2026-10-01T00:00:00.000Z"),
	thread("release", "Release prep", "2026-10-20T00:00:00.000Z"),
	thread("old", "Old plans", "2026-10-21T00:00:00.000Z", { closed: true }),
	thread("locked", "Locked notes", "2026-10-21T00:00:00.000Z", {
		canPost: false,
	}),
	thread("tokens", "Tokens", "2026-10-01T00:00:00.000Z"),
];

const input = (
	threads: NonNullable<ForwardSpaceInput["threads"]>,
): ForwardSpaceInput[] => [
	{
		space: hq,
		channels: [
			channel("general", "general"),
			channel("design", "design", { category: "work" }),
			channel("lounge", "Lounge", { type: VOICE }),
			channel("news", "news", { canPost: false }),
		],
		categories: [{ rkey: "work", name: "Work" } as never],
		threads,
	},
];

const loaded = input((entry) =>
	entry.space === ref("design") ? { value: designThreads } : { value: [] },
);

describe("forward targets", () => {
	it("groups forwardable channels with their open, postable threads by activity", () => {
		const [group] = forwardGroups(loaded, ref("general"));
		expect(group?.channels.map((entry) => entry.target.channel.name)).toEqual([
			"general",
			"design",
		]);
		const design = group?.channels[1];
		expect(design?.target.category).toBe("Work");
		expect(design?.loaded).toBe(true);
		expect(design?.threads.map((entry) => entry.thread?.name)).toEqual([
			"Release prep",
			"Icon review",
			"Tokens",
		]);
		expect(design?.threads[0]?.key).toBe(ref("release", THREAD));
		expect(group?.channels[0]?.target.current).toBe(true);
	});

	it("marks the current thread", () => {
		const [group] = forwardGroups(loaded, ref("release", THREAD));
		const design = group?.channels[1];
		expect(design?.target.current).toBe(false);
		expect(design?.threads.find((entry) => entry.current)?.key).toBe(
			ref("release", THREAD),
		);
	});

	it("reports thread lists that are loading, failed or not requested", () => {
		const groups = forwardGroups(
			input((entry) =>
				entry.space === ref("design")
					? { loading: true }
					: { failed: true, value: undefined },
			),
		);
		const [general, design] = groups[0]?.channels ?? [];
		expect(design).toMatchObject({
			loading: true,
			failed: false,
			loaded: false,
		});
		expect(general).toMatchObject({
			loading: false,
			failed: true,
			loaded: false,
		});
		const unrequested = forwardGroups(input(() => undefined));
		expect(unrequested[0]?.channels[1]).toMatchObject({
			loaded: false,
			loading: false,
			threads: [],
		});
	});

	it("matches thread names and flags the groups to expand", () => {
		const groups = forwardGroups(loaded);
		const byThread = filterForwardGroups(groups, "release");
		expect(byThread[0]?.channels).toHaveLength(1);
		expect(byThread[0]?.channels[0]?.threadMatch).toBe(true);
		expect(
			byThread[0]?.channels[0]?.threads.map((entry) => entry.thread?.name),
		).toEqual(["Release prep"]);

		const byChannel = filterForwardGroups(groups, "#des");
		expect(byChannel[0]?.channels[0]?.threadMatch).toBe(false);
		expect(byChannel[0]?.channels[0]?.threads).toHaveLength(3);

		const bySpace = filterForwardGroups(groups, "hq");
		expect(bySpace[0]?.channels).toHaveLength(2);
		expect(filterForwardGroups(groups, "old plans")).toEqual([]);
		expect(filterForwardGroups(groups, "  ")).toEqual(groups);
	});

	it("names threads and mixed destinations", () => {
		const [group] = forwardGroups(loaded);
		const design = group?.channels[1];
		const channelTarget = design?.target as ForwardTarget;
		const threadTarget = design?.threads[0] as ForwardTarget;
		expect(forwardChannelList([channelTarget, threadTarget])).toBe(
			"#design and Release prep",
		);
		expect(forwardDestinationNoun([channelTarget])).toBe("1 channel");
		expect(forwardDestinationNoun([threadTarget])).toBe("1 thread");
		expect(forwardDestinationNoun([threadTarget, threadTarget])).toBe(
			"2 threads",
		);
		expect(forwardDestinationNoun([channelTarget, threadTarget])).toBe(
			"2 places",
		);
	});
});
