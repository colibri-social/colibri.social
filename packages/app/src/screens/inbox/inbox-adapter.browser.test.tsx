import type { InboxNotification } from "@colibri-social/ui";
import { describe, expect, it } from "vitest";
import type { Facet, NotificationView } from "../../data/types";
import {
	channelTypeOf,
	inboxTarget,
	toInboxNotification,
	withoutFacet,
} from "./inbox-adapter";
import { groupBySpace, groupSummary } from "./inbox-groups";

const encoder = new TextEncoder();

const facetFor = (text: string, part: string, feature: object): Facet => {
	const start = text.indexOf(part);
	const byteStart = encoder.encode(text.slice(0, start)).length;
	return {
		index: { byteStart, byteEnd: byteStart + encoder.encode(part).length },
		features: [feature],
	} as unknown as Facet;
};

const CHANNEL =
	"at://did:plc:space/space/social.colibri.beta.channel.text/general";
const THREAD = "at://did:plc:space/space/social.colibri.beta.channel.thread/t1";

const view = (overrides: Partial<NotificationView>): NotificationView =>
	({
		id: "n1",
		kind: "mention",
		author: { did: "did:plc:mira", handle: "mira.test", displayName: "Mira" },
		channel: CHANNEL,
		community: "did:plc:space",
		indexedAt: "2026-10-10T10:00:00.000Z",
		...overrides,
	}) as NotificationView;

const context = {
	viewer: "did:plc:me",
	viewerLabel: "Louis",
	communities: new Map(),
	directory: () => undefined,
	roles: () => [
		{ rkey: "mods", name: "Moderators", color: "#f97316", position: 3 },
	],
	channelName: () => "general",
	threadName: () => "Hut logistics",
} as never;

describe("inbox adapter", () => {
	it("drops the mention from the preview text", () => {
		const text = "@Louis can you check the release notes?";
		const facet = facetFor(text, "@Louis", {
			$type: "social.colibri.beta.richtext.facet#mention",
			did: "did:plc:me",
		});
		expect(withoutFacet(text, facet)).toBe("can you check the release notes?");
		const middle = "Calling the @Night shift, anyone up? 🌙";
		expect(withoutFacet(middle, facetFor(middle, "@Night shift", {}))).toBe(
			"Calling the, anyone up? 🌙",
		);
	});

	it("maps a role mention with its label and color", () => {
		const text = "Reminder for @Moderators: lock the channel";
		const result = toInboxNotification(
			view({
				mentionRole: "Moderators",
				message: {
					rkey: "m1",
					text,
					facets: [
						facetFor(text, "@Moderators", {
							$type: "social.colibri.beta.richtext.facet#role",
							role: "mods",
						}),
					],
				} as never,
			}),
			context,
		);
		expect(result.kind).toBe("roleMention");
		expect(result.mentionLabel).toBe("@Moderators");
		expect(result.mentionRoleColor).toBe("#f97316");
		expect(result.text).toBe("Reminder for: lock the channel");
		expect(result.read).toBe(false);
	});

	it("maps a reply with its quote and a thread name", () => {
		const result = toInboxNotification(
			view({
				kind: "reply",
				thread: THREAD as never,
				seenAt: "2026-10-10T11:00:00.000Z" as never,
				message: {
					rkey: "m2",
					text: "Perfect, I'll bring gas",
					parent: { text: "I'll bring the stove" },
				} as never,
			}),
			context,
		);
		expect(result).toMatchObject({
			kind: "reply",
			replyTo: "I'll bring the stove",
			threadName: "Hut logistics",
			read: true,
		});
		expect(result.mentionLabel).toBeUndefined();
	});

	it("routes to the channel, or to the thread inside it", () => {
		expect(channelTypeOf(CHANNEL)).toBe("social.colibri.beta.channel.text");
		expect(
			inboxTarget(view({ message: { rkey: "m1" } as never })),
		).toMatchObject({
			space: "did:plc:space",
			channel: "general",
			jumpChannel: CHANNEL,
			rkey: "m1",
		});
		const threaded = inboxTarget(
			view({ thread: THREAD as never, message: { rkey: "m2" } as never }),
		);
		expect(threaded).toMatchObject({ thread: "t1", jumpChannel: THREAD });
	});
});

const entry = (
	id: string,
	spaceId: string,
	minutes: number,
	kind: InboxNotification["kind"] = "mention",
): InboxNotification => ({
	id,
	kind,
	spaceId,
	channelName: "general",
	author: "Mira",
	timestamp: new Date(2026, 9, 10, 12, minutes),
	text: "hi",
	read: false,
});

describe("inbox groups", () => {
	it("orders Spaces by their newest notification, newest first inside", () => {
		const spaces = new Map([
			["a", { id: "a", name: "Alpha" }],
			["b", { id: "b", name: "Beta" }],
		]);
		const groups = groupBySpace(
			[entry("1", "a", 1), entry("2", "b", 5), entry("3", "a", 9)],
			spaces,
		);
		expect(groups.map((group) => group.space.name)).toEqual(["Alpha", "Beta"]);
		expect(groups[0]?.notifications.map((item) => item.id)).toEqual(["3", "1"]);
	});

	it("falls back for an unknown Space and summarizes counts", () => {
		const groups = groupBySpace([entry("1", "gone", 1)], new Map());
		expect(groups[0]?.space.name).toBe("Unknown Space");
		expect(
			groupSummary([
				entry("1", "a", 1),
				entry("2", "a", 2, "reply"),
				entry("3", "a", 3, "roleMention"),
			]),
		).toBe("2 mentions, 1 reply");
	});
});
