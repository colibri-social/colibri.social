import type { ServerFrame } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { toLiveEvents } from "./frames";

const COMMUNITY = "did:plc:colibrihqspace2a4b6c8d";
const ALICE = "did:plc:alice";
const GENERAL = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/general`;
const PREFIX = "social.colibri.beta.sync.defs#";

const frame = (name: string, body: Record<string, unknown>) =>
	({ $type: `${PREFIX}${name}`, ...body }) as unknown as ServerFrame;

const message = { rkey: "3kmsg", text: "hi", author: { did: ALICE } };

describe("toLiveEvents", () => {
	it("maps message creates and updates with their view", () => {
		expect(
			toLiveEvents(
				frame("messageEvent", { event: "create", channel: GENERAL, message }),
			),
		).toEqual([
			{
				$type: "messageEvent",
				event: "create",
				channel: GENERAL,
				message,
				rkey: "3kmsg",
			},
		]);
	});

	it("takes the record key of a deleted message from its subject", () => {
		expect(
			toLiveEvents(
				frame("messageEvent", {
					event: "delete",
					channel: GENERAL,
					subject: { did: ALICE, rkey: "3kgone" },
				}),
			),
		).toEqual([
			{
				$type: "messageEvent",
				event: "delete",
				channel: GENERAL,
				rkey: "3kgone",
			},
		]);
	});

	it("drops message frames it cannot act on", () => {
		expect(
			toLiveEvents(
				frame("messageEvent", { event: "create", channel: GENERAL }),
			),
		).toEqual([]);
		expect(
			toLiveEvents(
				frame("messageEvent", { event: "delete", channel: GENERAL }),
			),
		).toEqual([]);
		expect(
			toLiveEvents(
				frame("messageEvent", { event: "pin", channel: GENERAL, message }),
			),
		).toEqual([]);
	});

	it("maps reactions to the target record key", () => {
		expect(
			toLiveEvents(
				frame("reactionEvent", {
					event: "delete",
					channel: GENERAL,
					target: { did: ALICE, rkey: "3kmsg" },
					emoji: "👍",
					actor: ALICE,
				}),
			),
		).toEqual([
			{
				$type: "reactionEvent",
				event: "delete",
				channel: GENERAL,
				target: "3kmsg",
				emoji: "👍",
				actor: ALICE,
			},
		]);
	});

	it("maps speaking and leaving voice frames to voice activity", () => {
		expect(
			toLiveEvents(
				frame("voiceEvent", {
					event: "speaking",
					channel: GENERAL,
					did: ALICE,
					speaking: true,
				}),
			),
		).toEqual([{ $type: "voiceActivityEvent", did: ALICE, speaking: true }]);
		expect(
			toLiveEvents(
				frame("voiceEvent", { event: "leave", channel: GENERAL, did: ALICE }),
			),
		).toEqual([{ $type: "voiceActivityEvent", did: ALICE, speaking: false }]);
		expect(
			toLiveEvents(
				frame("voiceEvent", { event: "join", channel: GENERAL, did: ALICE }),
			),
		).toEqual([]);
	});

	it("keeps seen frames only when they name a channel and a time", () => {
		expect(
			toLiveEvents(
				frame("seenEvent", {
					unread: 0,
					channel: GENERAL,
					seenAt: "2026-10-14T12:00:00.000Z",
				}),
			),
		).toEqual([
			{
				$type: "seenEvent",
				channel: GENERAL,
				unread: 0,
				seenAt: "2026-10-14T12:00:00.000Z",
			},
		]);
		expect(toLiveEvents(frame("seenEvent", { unread: 3 }))).toEqual([]);
	});

	it("treats thread activity as an update", () => {
		const thread = { space: GENERAL, name: "Plans" };
		expect(
			toLiveEvents(
				frame("threadEvent", {
					event: "activity",
					community: COMMUNITY,
					thread,
				}),
			),
		).toEqual([{ $type: "threadEvent", event: "update", thread }]);
	});

	it("maps structure changes and key-only deletes", () => {
		const channel = { space: GENERAL, name: "general" };
		expect(
			toLiveEvents(
				frame("channelEvent", {
					event: "update",
					community: COMMUNITY,
					channel,
				}),
			),
		).toEqual([
			{ $type: "channelEvent", event: "update", community: COMMUNITY, channel },
		]);
		expect(
			toLiveEvents(
				frame("channelEvent", {
					event: "delete",
					community: COMMUNITY,
					space: GENERAL,
				}),
			),
		).toEqual([
			{ $type: "channelRemovedEvent", community: COMMUNITY, channel: GENERAL },
		]);
		expect(
			toLiveEvents(
				frame("roleEvent", {
					event: "delete",
					community: COMMUNITY,
					rkey: "r1",
				}),
			),
		).toEqual([
			{ $type: "roleRemovedEvent", community: COMMUNITY, rkey: "r1" },
		]);
		expect(
			toLiveEvents(
				frame("categoryEvent", {
					event: "delete",
					community: COMMUNITY,
					rkey: "c1",
				}),
			),
		).toEqual([
			{ $type: "categoryRemovedEvent", community: COMMUNITY, rkey: "c1" },
		]);
		expect(
			toLiveEvents(
				frame("communityEvent", { event: "delete", community: COMMUNITY }),
			),
		).toEqual([{ $type: "communityRemovedEvent", community: COMMUNITY }]);
		expect(
			toLiveEvents(
				frame("channelEvent", { event: "delete", community: COMMUNITY }),
			),
		).toEqual([]);
	});

	it("maps member updates to their roles", () => {
		expect(
			toLiveEvents(
				frame("memberEvent", {
					event: "update",
					community: COMMUNITY,
					member: { actor: { did: ALICE }, roles: ["mod"], joinedAt: "x" },
				}),
			),
		).toEqual([
			{
				$type: "memberRolesEvent",
				community: COMMUNITY,
				subject: ALICE,
				roles: ["mod"],
			},
		]);
		expect(
			toLiveEvents(
				frame("memberEvent", { event: "join", community: COMMUNITY }),
			),
		).toEqual([]);
	});

	it("turns application changes into an access refresh", () => {
		expect(
			toLiveEvents(
				frame("applicationEvent", {
					event: "create",
					community: COMMUNITY,
					subject: ALICE,
				}),
			),
		).toEqual([
			{ $type: "accessEvent", community: COMMUNITY, kind: "applications" },
		]);
	});

	it("ignores frames the app has no event for", () => {
		expect(toLiveEvents(frame("ack", {}))).toEqual([]);
		expect(
			toLiveEvents(frame("preferencesEvent", { preferences: {} })),
		).toEqual([]);
	});

	it("keeps the message a seen frame names", () => {
		expect(
			toLiveEvents(
				frame("seenEvent", {
					unread: 2,
					channel: GENERAL,
					seenAt: "2026-10-15T00:00:00.000Z",
					message: { did: ALICE, rkey: "3kmsg" },
				}),
			),
		).toEqual([
			{
				$type: "seenEvent",
				channel: GENERAL,
				message: { did: ALICE, rkey: "3kmsg" },
				unread: 2,
				seenAt: "2026-10-15T00:00:00.000Z",
			},
		]);
	});

	it("maps a read cursor frame to the community and its cursors", () => {
		expect(
			toLiveEvents(
				frame("readCursorEvent", {
					community: COMMUNITY,
					cursors: [{ channel: "general", cursor: "3kaaaaaaaaa7" }],
				}),
			),
		).toEqual([
			{
				$type: "readCursorEvent",
				community: COMMUNITY,
				cursors: [{ channel: "general", cursor: "3kaaaaaaaaa7" }],
			},
		]);
	});

	it("drops a read cursor frame with no cursors", () => {
		expect(
			toLiveEvents(
				frame("readCursorEvent", { community: COMMUNITY, cursors: [] }),
			),
		).toEqual([]);
	});

	it("maps a preferences frame to the GIF favorites it carries", () => {
		const gif = {
			id: "g1",
			url: "https://media.example/g1.gif",
			previewUrl: "https://media.example/g1.webp",
			width: 200,
			height: 100,
		};
		expect(
			toLiveEvents(
				frame("preferencesEvent", {
					preferences: {
						notificationLevel: "all",
						communityOrder: [],
						mutes: [],
						gifFavorites: [gif],
					},
				}),
			),
		).toEqual([{ $type: "preferencesEvent", gifFavorites: [gif] }]);
	});
});
