import { describe, expect, it } from "vitest";
import {
	decodeFrame,
	encodeFrame,
	frameIs,
	heartbeatFrame,
	PROGRESS_STEP_LABELS,
	progressStepLabel,
	setPresenceFrame,
	subscribeFrame,
	typingFrame,
	unsubscribeFrame,
	viewChannelFrame,
} from "./sync-frames";

const DID = "did:plc:community1234567890abc";
const CHANNEL =
	"at://did:plc:community1234567890abc/space/social.colibri.beta.channel.text/general";
const HANDLE = "alice.test";
const DATETIME = "2026-08-23T12:00:00.000Z";

describe("client frame round-tripping", () => {
	it("round-trips subscribeFrame", () => {
		const frame = subscribeFrame({ communities: [DID], channels: [CHANNEL] });
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#subscribe",
			communities: [DID],
			channels: [CHANNEL],
		});
	});

	it("round-trips unsubscribeFrame", () => {
		const frame = unsubscribeFrame({ communities: [DID] });
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#unsubscribe",
			communities: [DID],
		});
	});

	it("round-trips heartbeatFrame", () => {
		const frame = heartbeatFrame();
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#heartbeat",
		});
	});

	it("round-trips typingFrame", () => {
		const frame = typingFrame(CHANNEL);
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#typing",
			channel: CHANNEL,
		});
	});

	it("round-trips viewChannelFrame with a channel", () => {
		const frame = viewChannelFrame(CHANNEL);
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#viewChannel",
			channel: CHANNEL,
		});
	});

	it("round-trips viewChannelFrame with no channel", () => {
		const frame = viewChannelFrame();
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#viewChannel",
		});
	});

	it("round-trips setPresenceFrame", () => {
		const frame = setPresenceFrame({
			onlineState: "away",
			voice: { channel: CHANNEL, muted: true },
		});
		expect(JSON.parse(encodeFrame(frame))).toEqual({
			$type: "social.colibri.beta.sync.defs#setPresence",
			onlineState: "away",
			voice: { channel: CHANNEL, muted: true },
		});
	});
});

describe("decodeFrame server shapes", () => {
	it("decodes an ack frame", () => {
		const decoded = decodeFrame(
			JSON.stringify({ $type: "social.colibri.beta.sync.defs#ack" }),
		);
		expect(decoded).toEqual({ $type: "social.colibri.beta.sync.defs#ack" });
	});

	it("decodes an error frame", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#error",
				error: "RateLimited",
				message: "slow down",
			}),
		);
		expect(decoded).toEqual({
			$type: "social.colibri.beta.sync.defs#error",
			error: "RateLimited",
			message: "slow down",
		});
	});

	it("decodes a subscribed frame", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#subscribed",
				communities: [DID],
				channels: [CHANNEL],
			}),
		);
		expect(decoded).toEqual({
			$type: "social.colibri.beta.sync.defs#subscribed",
			communities: [DID],
			channels: [CHANNEL],
		});
	});

	it("decodes a messageEvent delete", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#messageEvent",
				event: "delete",
				channel: CHANNEL,
				subject: { did: DID, rkey: "abc123" },
			}),
		);
		expect(decoded).toMatchObject({ event: "delete", channel: CHANNEL });
	});

	it("decodes a reactionEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#reactionEvent",
				event: "create",
				channel: CHANNEL,
				target: { did: DID, rkey: "abc123" },
				emoji: "🎉",
				actor: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "create", emoji: "🎉" });
	});

	it("decodes a channelEvent delete", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#channelEvent",
				event: "delete",
				community: DID,
				space: CHANNEL,
			}),
		);
		expect(decoded).toMatchObject({ event: "delete", community: DID });
	});

	it("decodes a categoryEvent delete", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#categoryEvent",
				event: "delete",
				community: DID,
				rkey: "abc123",
			}),
		);
		expect(decoded).toMatchObject({ event: "delete", rkey: "abc123" });
	});

	it("decodes a roleEvent delete", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#roleEvent",
				event: "delete",
				community: DID,
				rkey: "abc123",
			}),
		);
		expect(decoded).toMatchObject({ event: "delete", rkey: "abc123" });
	});

	it("decodes a memberEvent leave", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#memberEvent",
				event: "leave",
				community: DID,
				subject: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "leave", subject: DID });
	});

	it("decodes a communityEvent delete", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#communityEvent",
				event: "delete",
				community: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "delete", community: DID });
	});

	it("decodes an applicationEvent approve", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#applicationEvent",
				event: "approve",
				community: DID,
				subject: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "approve", subject: DID });
	});

	it("decodes a labelEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#labelEvent",
				event: "create",
				space: CHANNEL,
				subject: {
					did: DID,
					collection: "social.colibri.beta.message",
					rkey: "abc123",
				},
				val: "spam",
				src: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "create", val: "spam" });
	});

	it("decodes a moderationEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#moderationEvent",
				community: DID,
				entry: {
					rkey: "abc123",
					action: "kick",
					subject: {
						did: DID,
						handle: HANDLE,
						displayName: "Alice",
						isBot: false,
						syncBluesky: false,
					},
					createdBy: DID,
					createdAt: DATETIME,
				},
			}),
		);
		expect(decoded).toMatchObject({ community: DID });
	});

	it("decodes a notificationEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#notificationEvent",
				notification: {
					id: "notif1",
					kind: "mention",
					author: {
						did: DID,
						handle: HANDLE,
						displayName: "Alice",
						isBot: false,
						syncBluesky: false,
					},
					channel: CHANNEL,
					community: DID,
					indexedAt: DATETIME,
				},
			}),
		);
		expect(decoded).toMatchObject({
			$type: "social.colibri.beta.sync.defs#notificationEvent",
		});
	});

	it("decodes a seenEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#seenEvent",
				unread: 3,
				channel: CHANNEL,
				seenAt: DATETIME,
			}),
		);
		expect(decoded).toMatchObject({ unread: 3 });
	});

	it("decodes a presenceEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#presenceEvent",
				did: DID,
				presence: { onlineState: "online" },
			}),
		);
		expect(decoded).toMatchObject({ did: DID });
	});

	it("decodes a preferencesEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#preferencesEvent",
				preferences: {
					notificationLevel: "mentionsAndReplies",
					communityOrder: [DID],
					mutes: [],
					gifFavorites: [],
				},
			}),
		);
		expect(decoded).toMatchObject({
			preferences: { notificationLevel: "mentionsAndReplies" },
		});
	});

	it("drops a preferencesEvent that is missing its preferences", () => {
		expect(
			decodeFrame(
				JSON.stringify({
					$type: "social.colibri.beta.sync.defs#preferencesEvent",
				}),
			),
		).toBeNull();
	});

	it("decodes a typingEvent", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#typingEvent",
				did: DID,
				channel: CHANNEL,
			}),
		);
		expect(decoded).toMatchObject({ did: DID, channel: CHANNEL });
	});

	it("decodes a voiceEvent leave", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#voiceEvent",
				event: "leave",
				channel: CHANNEL,
				did: DID,
			}),
		);
		expect(decoded).toMatchObject({ event: "leave" });
	});

	it("decodes a communityProgressEvent with a step outside knownValues", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#communityProgressEvent",
				step: "verifyingCredentials",
				completed: 1,
				total: 5,
			}),
		);
		expect(decoded).toMatchObject({ step: "verifyingCredentials" });
	});
});

describe("decodeFrame rejection", () => {
	it("rejects malformed JSON", () => {
		expect(decodeFrame("{not valid json")).toBeNull();
	});

	it("rejects a non-object payload", () => {
		expect(decodeFrame(JSON.stringify("just a string"))).toBeNull();
	});

	it("rejects a missing $type", () => {
		expect(decodeFrame(JSON.stringify({ unread: 1 }))).toBeNull();
	});

	it("rejects an unknown nsid", () => {
		expect(
			decodeFrame(JSON.stringify({ $type: "app.bsky.feed.post" })),
		).toBeNull();
	});

	it("rejects an unknown hash on the sync defs nsid", () => {
		expect(
			decodeFrame(
				JSON.stringify({ $type: "social.colibri.beta.sync.defs#bogus" }),
			),
		).toBeNull();
	});

	it("rejects a frame whose fields violate the schema", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#seenEvent",
				unread: "three",
			}),
		);
		expect(decoded).toBeNull();
	});

	it("rejects a frame missing a required field", () => {
		const decoded = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#typingEvent",
				did: DID,
			}),
		);
		expect(decoded).toBeNull();
	});
});

describe("progressStepLabel", () => {
	it("labels every known step", () => {
		for (const step of Object.keys(PROGRESS_STEP_LABELS)) {
			expect(progressStepLabel(step)).toBe(PROGRESS_STEP_LABELS[step]);
		}
	});

	it("falls back for a step the lexicon does not enumerate", () => {
		expect(progressStepLabel("verifyingCredentials")).toBe(
			"Verifying credentials",
		);
		expect(progressStepLabel("somethingBrandNew")).toBe("Working");
	});

	it("names every step a migration reports", () => {
		for (const step of [
			"readingLegacyRepo",
			"creatingSpaces",
			"writingProfile",
			"migratingRoles",
			"migratingMembers",
			"migratingChannels",
			"migratingCategories",
			"mirroringMessages",
			"done",
		]) {
			expect(progressStepLabel(step)).not.toBe("Working");
		}
	});
});

describe("frameIs", () => {
	it("narrows a frame to the named variant", () => {
		const frame = decodeFrame(
			JSON.stringify({
				$type: "social.colibri.beta.sync.defs#presenceEvent",
				did: "did:plc:abc",
				presence: { onlineState: "online" },
			}),
		);

		expect(frame).not.toBeNull();
		if (!frame) return;

		expect(frameIs(frame, "presenceEvent")).toBe(true);
		expect(frameIs(frame, "memberEvent")).toBe(false);
		if (frameIs(frame, "presenceEvent")) {
			expect(frame.presence.onlineState).toBe("online");
		}
	});
});
