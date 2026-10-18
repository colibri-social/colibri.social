import { describe, expect, it } from "vitest";
import { createLiveTails, placeMessage, reactIn } from "./live-tail";
import type { Did, MessageView, ReactionEmojiRef, SpaceRef } from "./types";

const GENERAL = "at://did:plc:hq/space/c1" as SpaceRef;
const DEV = "at://did:plc:hq/space/c2" as SpaceRef;
const VIEWER = "did:plc:viewer" as Did;

const message = (rkey: string, channel = GENERAL): MessageView =>
	({
		uri: `at://did:plc:a/social.colibri.beta.channel.message/${rkey}`,
		rkey,
		channel,
		author: { did: "did:plc:a", handle: "a.test" },
		text: rkey,
		createdAt: "2026-10-18T10:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
	}) as unknown as MessageView;

const rkeys = (list: readonly MessageView[] | undefined) =>
	(list ?? []).map((entry) => entry.rkey);

describe("live tails", () => {
	it("starts a tail at the first message and keeps it sorted", () => {
		const tails = createLiveTails();
		tails.append(GENERAL, message("b"), { epoch: "1:0", after: "a" });
		tails.append(GENERAL, message("d"));
		tails.append(GENERAL, message("c"));
		const tail = tails.peek(GENERAL);
		expect(rkeys(tail?.messages)).toEqual(["b", "c", "d"]);
		expect(tail?.cursor).toBe("b");
		expect(tail?.after).toBe("a");
		expect(tail?.epoch).toBe("1:0");
	});

	it("keeps fifty messages per channel and moves the cursor and predecessor", () => {
		const tails = createLiveTails({ perChannel: 3 });
		for (const rkey of ["a", "b", "c", "d", "e"])
			tails.append(GENERAL, message(rkey));
		const tail = tails.peek(GENERAL);
		expect(rkeys(tail?.messages)).toEqual(["c", "d", "e"]);
		expect(tail?.cursor).toBe("c");
		expect(tail?.after).toBe("b");
		expect(tails.size()).toBe(3);
	});

	it("evicts the least recently touched channel past the total", () => {
		const evicted: SpaceRef[] = [];
		const tails = createLiveTails({
			perChannel: 3,
			total: 4,
			onEvict: (ref) => evicted.push(ref),
		});
		tails.append(GENERAL, message("a"));
		tails.append(GENERAL, message("b"));
		tails.append(DEV, message("c", DEV));
		tails.append(DEV, message("d", DEV));
		tails.append(DEV, message("e", DEV));
		expect(evicted).toEqual([GENERAL]);
		expect(tails.has(GENERAL)).toBe(false);
		expect(tails.size()).toBe(3);
	});

	it("applies edits, deletes and reactions only to messages it holds", () => {
		const tails = createLiveTails();
		tails.append(GENERAL, message("a"));
		tails.update(GENERAL, { ...message("a"), text: "edited" });
		tails.update(GENERAL, { ...message("z"), text: "unknown" });
		tails.react(GENERAL, {
			rkey: "a",
			emoji: "👍",
			actor: VIEWER,
			add: true,
			viewer: VIEWER,
		});
		const held = tails.peek(GENERAL)?.messages[0];
		expect(held?.text).toBe("edited");
		expect(held?.reactions).toEqual([
			{ emoji: "👍", count: 1, reactors: [VIEWER], viewerReacted: true },
		]);
		expect(rkeys(tails.peek(GENERAL)?.messages)).toEqual(["a"]);
		tails.remove(GENERAL, "a");
		expect(tails.peek(GENERAL)?.messages).toEqual([]);
		tails.dropWhere((ref) => ref === GENERAL);
		expect(tails.has(GENERAL)).toBe(false);
		expect(tails.size()).toBe(0);
	});

	it("leaves lists untouched when a reaction changes nothing", () => {
		const list = [message("a")];
		expect(
			reactIn(list, {
				rkey: "a",
				emoji: "👍",
				actor: VIEWER,
				add: false,
				viewer: VIEWER,
			}),
		).toBe(list);
		expect(rkeys(placeMessage(list, message("0")))).toEqual(["0", "a"]);
	});

	it("keeps the emoji record a custom reaction names", () => {
		const customEmoji = {
			uri: "at://did:plc:a/social.colibri.beta.emoji/party",
		} as ReactionEmojiRef;
		const first = reactIn([message("a")], {
			rkey: "a",
			emoji: ":party:",
			actor: "did:plc:a" as Did,
			add: true,
			viewer: VIEWER,
		});
		const second = reactIn(first, {
			rkey: "a",
			emoji: ":party:",
			customEmoji,
			actor: VIEWER,
			add: true,
			viewer: VIEWER,
		});
		expect(second[0]?.reactions[0]).toMatchObject({
			emoji: ":party:",
			count: 2,
			customEmoji,
			viewerReacted: true,
		});
	});
});
