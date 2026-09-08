import { describe, expect, it } from "vitest";
import type { ThreadView } from "../atproto/views";
import {
	anchorKey,
	indexThreadAnchors,
	isRecentlyActive,
	markThreadRead,
	matchesFilter,
	removeThread,
	sidebarThreads,
	sortThreads,
	threadAnchoredAt,
	threadsInChannel,
	touchThread,
	upsertThread,
} from "./thread-list";

const DID = "did:plc:community";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;
const OTHER = `at://${DID}/space/social.colibri.beta.channel.text/help`;

const thread = (
	skey: string,
	overrides: Partial<ThreadView> = {},
): ThreadView =>
	({
		space: `at://${DID}/space/social.colibri.beta.channel.thread/${skey}`,
		channel: CHANNEL,
		community: DID,
		name: skey,
		createdBy: "did:plc:opener",
		createdAt: "2026-01-01T00:00:00.000Z",
		lastActivityAt: "2026-01-01T00:00:00.000Z",
		messageCount: 1,
		participants: [],
		viewer: {
			canRead: true,
			canPost: true,
			canManage: false,
			following: false,
			muted: false,
			hasUnread: false,
			unreadMentions: 0,
		},
		...overrides,
	}) as ThreadView;

describe("sortThreads", () => {
	it("puts the most recently active first", () => {
		const older = thread("a", { lastActivityAt: "2026-01-01T00:00:00.000Z" });
		const newer = thread("b", { lastActivityAt: "2026-02-01T00:00:00.000Z" });
		expect(sortThreads([older, newer]).map((t) => t.name)).toEqual(["b", "a"]);
	});

	it("breaks a tie on the space so the order is stable", () => {
		const first = thread("a");
		const second = thread("b");
		expect(sortThreads([second, first]).map((t) => t.name)).toEqual(["a", "b"]);
	});
});

const anchor = (id: string): ThreadView["anchorMessage"] =>
	({ uri: `at://${id}` }) as unknown as ThreadView["anchorMessage"];

describe("upsertThread", () => {
	it("replaces a thread that is already listed", () => {
		const existing = thread("a");
		const renamed = { ...existing, name: "renamed" };
		expect(upsertThread([existing], renamed)).toEqual([renamed]);
	});

	it("keeps the anchor message when the replacement was not hydrated with one", () => {
		const anchorMessage = anchor("anchor");
		const existing = thread("a", { anchorMessage });
		const [merged] = upsertThread([existing], thread("a", { name: "renamed" }));
		expect(merged?.name).toBe("renamed");
		expect(merged?.anchorMessage).toBe(anchorMessage);
	});

	it("takes the replacement's anchor message when it has one", () => {
		const existing = thread("a", { anchorMessage: anchor("old") });
		const anchorMessage = anchor("new");
		const [merged] = upsertThread([existing], thread("a", { anchorMessage }));
		expect(merged?.anchorMessage).toBe(anchorMessage);
	});
});

describe("removeThread", () => {
	it("drops the named thread and leaves the rest", () => {
		const a = thread("a");
		const b = thread("b");
		expect(removeThread([a, b], a.space)).toEqual([b]);
	});
});

describe("touchThread", () => {
	it("moves the activity forward and marks it unread", () => {
		const existing = thread("a");
		const [touched] = touchThread(
			[existing],
			existing.space,
			"2026-03-01T00:00:00.000Z" as ThreadView["lastActivityAt"],
			{ markUnread: true },
		);
		expect(touched.lastActivityAt).toBe("2026-03-01T00:00:00.000Z");
		expect(touched.viewer.hasUnread).toBe(true);
	});

	it("leaves the unread flag alone when the thread is the one being read", () => {
		const existing = thread("a");
		const [touched] = touchThread(
			[existing],
			existing.space,
			"2026-03-01T00:00:00.000Z" as ThreadView["lastActivityAt"],
			{ markUnread: false },
		);
		expect(touched.viewer.hasUnread).toBe(false);
	});

	it("ignores activity that is older than what is already known", () => {
		const existing = thread("a", {
			lastActivityAt:
				"2026-05-01T00:00:00.000Z" as ThreadView["lastActivityAt"],
		});
		const [touched] = touchThread(
			[existing],
			existing.space,
			"2026-03-01T00:00:00.000Z" as ThreadView["lastActivityAt"],
			{ markUnread: true },
		);
		expect(touched).toEqual(existing);
	});

	it("ignores a thread it does not know about", () => {
		const existing = thread("a");
		expect(
			touchThread(
				[existing],
				"at://did:plc:community/space/social.colibri.beta.channel.thread/gone",
				"2026-03-01T00:00:00.000Z" as ThreadView["lastActivityAt"],
				{ markUnread: true },
			),
		).toEqual([existing]);
	});
});

describe("markThreadRead", () => {
	it("clears the unread flag and the mention count", () => {
		const existing = thread("a", {
			viewer: {
				canRead: true,
				canPost: true,
				canManage: false,
				following: false,
				muted: false,
				hasUnread: true,
				unreadMentions: 3,
			},
		});
		const [read] = markThreadRead([existing], existing.space);
		expect(read.viewer.hasUnread).toBe(false);
		expect(read.viewer.unreadMentions).toBe(0);
	});
});

describe("matchesFilter", () => {
	const unread = thread("a", {
		viewer: {
			canRead: true,
			canPost: true,
			canManage: false,
			following: false,
			muted: false,
			hasUnread: true,
			unreadMentions: 0,
		},
	});
	const followed = thread("b", {
		viewer: {
			canRead: true,
			canPost: true,
			canManage: false,
			following: true,
			muted: false,
			hasUnread: false,
			unreadMentions: 0,
		},
	});

	it("keeps everything under all", () => {
		expect(matchesFilter(unread, "all")).toBe(true);
		expect(matchesFilter(followed, "all")).toBe(true);
	});

	it("keeps only unread threads under unread", () => {
		expect(matchesFilter(unread, "unread")).toBe(true);
		expect(matchesFilter(followed, "unread")).toBe(false);
	});

	it("keeps only followed threads under following", () => {
		expect(matchesFilter(followed, "following")).toBe(true);
		expect(matchesFilter(unread, "following")).toBe(false);
	});
});

describe("threadsInChannel", () => {
	it("keeps the threads belonging to the given channel", () => {
		const here = thread("a");
		const elsewhere = thread("b", {
			channel: OTHER as ThreadView["channel"],
		});
		expect(threadsInChannel([here, elsewhere], CHANNEL)).toEqual([here]);
	});
});

describe("threadAnchoredAt", () => {
	const anchored = thread("a", {
		anchor: {
			space: CHANNEL as ThreadView["channel"],
			did: "did:plc:author" as ThreadView["createdBy"],
			rkey: "3lmessage" as never,
		},
	});

	it("finds the thread hanging off a message", () => {
		expect(
			threadAnchoredAt([anchored], CHANNEL, "did:plc:author", "3lmessage"),
		).toBe(anchored);
	});

	it("does not match once the anchor sits in another channel", () => {
		expect(
			threadAnchoredAt([anchored], OTHER, "did:plc:author", "3lmessage"),
		).toBeUndefined();
	});

	it("ignores a thread opened from scratch", () => {
		expect(
			threadAnchoredAt([thread("b")], CHANNEL, "did:plc:author", "3lmessage"),
		).toBeUndefined();
	});
});

describe("isRecentlyActive", () => {
	const now = Date.parse("2026-01-02T00:00:00.000Z");

	it("counts a thread written to within the window", () => {
		expect(
			isRecentlyActive(
				thread("a", {
					lastActivityAt:
						"2026-01-01T23:00:00.000Z" as ThreadView["lastActivityAt"],
				}),
				now,
			),
		).toBe(true);
	});

	it("drops a thread that has gone quiet", () => {
		expect(isRecentlyActive(thread("a"), now)).toBe(false);
	});
});

describe("sidebarThreads", () => {
	const now = Date.parse("2026-01-02T00:00:00.000Z");

	it("keeps a quiet thread that is still unread", () => {
		const quiet = thread("a", {
			viewer: {
				canRead: true,
				canPost: true,
				canManage: false,
				following: false,
				muted: false,
				hasUnread: true,
				unreadMentions: 0,
			},
		});
		expect(sidebarThreads([quiet], CHANNEL, now, 5)).toEqual([quiet]);
	});

	const viewer = (
		overrides: Partial<ThreadView["viewer"]>,
	): ThreadView["viewer"] => ({
		canRead: true,
		canPost: true,
		canManage: false,
		following: false,
		muted: false,
		hasUnread: false,
		unreadMentions: 0,
		...overrides,
	});

	it("keeps a quiet thread the reader follows", () => {
		const followed = thread("a", { viewer: viewer({ following: true }) });
		expect(sidebarThreads([followed], CHANNEL, now, 5)).toEqual([followed]);
	});

	it("keeps the thread that is open", () => {
		const quiet = thread("a");
		expect(
			sidebarThreads([quiet], CHANNEL, now, 5, { open: quiet.space }),
		).toEqual([quiet]);
	});

	it("keeps a thread opened within the last day", () => {
		const quiet = thread("a");
		const context = { openedAt: { [quiet.space]: now - 60 * 60 * 1000 } };
		expect(sidebarThreads([quiet], CHANNEL, now, 5, context)).toEqual([quiet]);
	});

	it("drops a thread opened more than a day ago", () => {
		const quiet = thread("a");
		const context = { openedAt: { [quiet.space]: now - 25 * 60 * 60 * 1000 } };
		expect(sidebarThreads([quiet], CHANNEL, now, 5, context)).toEqual([]);
	});

	it("caps the list at the given limit", () => {
		const recent = Array.from({ length: 8 }, (_, i) =>
			thread(`t${i}`, {
				lastActivityAt:
					"2026-01-01T23:30:00.000Z" as ThreadView["lastActivityAt"],
			}),
		);
		expect(sidebarThreads(recent, CHANNEL, now, 3)).toHaveLength(3);
	});
});

describe("indexThreadAnchors", () => {
	const anchored = (
		space: string,
		suffix: string,
		anchor: { space: string; did: string; rkey: string },
	) => ({ ...thread(suffix), space, anchor }) as ThreadView;

	it("finds the same thread a linear scan would", () => {
		const target = anchored(`${CHANNEL}/t/a`, "a", {
			space: CHANNEL,
			did: "did:plc:author",
			rkey: "3lmessage",
		});
		const index = indexThreadAnchors([target]);

		expect(index.get(anchorKey(CHANNEL, "did:plc:author", "3lmessage"))).toBe(
			target,
		);
		expect(
			threadAnchoredAt([target], CHANNEL, "did:plc:author", "3lmessage"),
		).toBe(target);
	});

	it("skips threads that were not opened from a message", () => {
		expect(indexThreadAnchors([thread("b")]).size).toBe(0);
	});

	it("keeps the first thread when two claim the same anchor, matching a scan", () => {
		const anchor = {
			space: CHANNEL,
			did: "did:plc:author",
			rkey: "3lmessage",
		};
		const first = anchored(`${CHANNEL}/t/a`, "a", anchor);
		const second = anchored(`${CHANNEL}/t/b`, "b", anchor);
		const list = [first, second];

		expect(
			indexThreadAnchors(list).get(
				anchorKey(anchor.space, anchor.did, anchor.rkey),
			),
		).toBe(threadAnchoredAt(list, anchor.space, anchor.did, anchor.rkey));
	});

	it("keeps anchors in different channels apart", () => {
		const target = anchored(`${CHANNEL}/t/a`, "a", {
			space: CHANNEL,
			did: "did:plc:author",
			rkey: "3lmessage",
		});
		const index = indexThreadAnchors([target]);

		expect(
			index.get(anchorKey(OTHER, "did:plc:author", "3lmessage")),
		).toBeUndefined();
	});
});
