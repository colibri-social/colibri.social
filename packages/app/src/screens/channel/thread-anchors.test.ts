import { describe, expect, it } from "vitest";
import type { SpaceRef, ThreadView } from "../../data/types";
import { indexThreadAnchors, threadAnchorKey } from "./thread-anchors";

const CHANNEL =
	"at://did:plc:space/space/social.colibri.beta.channel.text/dev" as SpaceRef;
const OTHER =
	"at://did:plc:space/space/social.colibri.beta.channel.text/general" as SpaceRef;

const listed = (
	name: string,
	anchor?: { space: SpaceRef; did: string; rkey: string },
): ThreadView =>
	({
		space: `at://did:plc:space/space/social.colibri.beta.channel.thread/${name}`,
		channel: CHANNEL,
		community: "did:plc:space",
		name,
		...(anchor ? { anchor } : {}),
		createdBy: "did:plc:alice",
		createdAt: "2026-10-18T10:00:00.000Z",
		lastActivityAt: "2026-10-18T10:00:00.000Z",
		messageCount: 1,
		participants: [],
		viewer: { canRead: true, canPost: true, following: false, muted: false },
	}) as unknown as ThreadView;

describe("indexThreadAnchors", () => {
	it("keys list-shaped threads by anchor author and rkey", () => {
		const thread = listed("one", {
			space: CHANNEL,
			did: "did:plc:alice",
			rkey: "3abc",
		});
		const map = indexThreadAnchors([thread], CHANNEL);
		expect(thread.anchorMessage).toBeUndefined();
		expect(map.get(threadAnchorKey("did:plc:alice", "3abc"))).toBe(thread);
		expect(map.get(threadAnchorKey("did:plc:bob", "3abc"))).toBeUndefined();
	});

	it("skips threads anchored in another channel or opened from scratch", () => {
		const moved = listed("moved", {
			space: OTHER,
			did: "did:plc:alice",
			rkey: "3abc",
		});
		const scratch = listed("scratch");
		expect(indexThreadAnchors([moved, scratch], CHANNEL).size).toBe(0);
	});

	it("returns nothing without a channel", () => {
		const thread = listed("one", {
			space: CHANNEL,
			did: "did:plc:alice",
			rkey: "3abc",
		});
		expect(indexThreadAnchors([thread], undefined).size).toBe(0);
	});
});
