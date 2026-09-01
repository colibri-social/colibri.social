import { describe, expect, it } from "vitest";
import { audienceChange, describeMoveBlock, planMove } from "./thread-move";
import type { MessageView } from "./views";

const DID = "did:plc:community";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;
const THREAD = `at://${DID}/space/social.colibri.beta.channel.thread/3lthread`;
const ME = "did:plc:me";
const THEM = "did:plc:them";

const message = (
	rkey: string,
	overrides: Partial<MessageView> = {},
): MessageView =>
	({
		uri: `${CHANNEL}/${ME}/social.colibri.beta.message/${rkey}`,
		rkey,
		channel: CHANNEL,
		author: { did: ME },
		text: "hello",
		createdAt: "2026-01-01T00:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
		...overrides,
	}) as unknown as MessageView;

describe("planMove", () => {
	it("rewrites when every message is the caller's own", () => {
		const plan = planMove([message("3lb"), message("3la")], {
			actor: ME,
			canModerate: false,
		});
		expect(plan).toMatchObject({ kind: "rewrite", source: CHANNEL });
		expect(plan.kind === "rewrite" && plan.subjects.map((s) => s.rkey)).toEqual(
			["3la", "3lb"],
		);
	});

	it("labels the move when someone else's message is in the selection", () => {
		const plan = planMove(
			[message("3la"), message("3lb", { author: { did: THEM } as never })],
			{ actor: ME, canModerate: true },
		);
		expect(plan.kind).toBe("moderate");
	});

	it("blocks a mixed selection when the caller cannot move other people's messages", () => {
		expect(
			planMove([message("3la", { author: { did: THEM } as never })], {
				actor: ME,
				canModerate: false,
			}),
		).toEqual({ kind: "blocked", reason: "not-permitted" });
	});

	it("blocks an empty selection", () => {
		expect(planMove([], { actor: ME, canModerate: true })).toEqual({
			kind: "blocked",
			reason: "nothing-selected",
		});
	});

	it("blocks a legacy message, which cannot be rewritten or labelled", () => {
		expect(
			planMove([message("3la", { legacy: true })], {
				actor: ME,
				canModerate: true,
			}),
		).toEqual({ kind: "blocked", reason: "legacy-message" });
	});

	it("blocks a selection spanning two spaces, since a move names one source", () => {
		expect(
			planMove([message("3la"), message("3lb", { channel: THREAD as never })], {
				actor: ME,
				canModerate: true,
			}),
		).toEqual({ kind: "blocked", reason: "mixed-sources" });
	});

	it("rewrites an own message carrying an attachment", () => {
		const withFile = message("3la", {
			attachments: [{ alt: "" }] as never,
		});
		expect(planMove([withFile], { actor: ME, canModerate: false }).kind).toBe(
			"rewrite",
		);
	});
});

describe("describeMoveBlock", () => {
	it("explains every reason", () => {
		for (const reason of [
			"nothing-selected",
			"mixed-sources",
			"legacy-message",
			"not-permitted",
		] as const) {
			expect(describeMoveBlock(reason).length).toBeGreaterThan(0);
		}
	});
});

describe("audienceChange", () => {
	it("reports no change between two open spaces", () => {
		expect(audienceChange({}, {}).changed).toBe(false);
	});

	it("reports a move into a private space", () => {
		const change = audienceChange({}, { visibleToRoles: ["mods"] });
		expect(change.changed).toBe(true);
		expect(change.toPrivate).toBe(true);
		expect(change.gainedRoles).toEqual(["mods"]);
	});

	it("reports a move out of a private space", () => {
		const change = audienceChange({ visibleToMembers: [ME] }, {});
		expect(change.changed).toBe(true);
		expect(change.fromPrivate).toBe(true);
		expect(change.lostMembers).toEqual([ME]);
	});

	it("reports no change when both sides restrict to the same role", () => {
		expect(
			audienceChange({ visibleToRoles: ["mods"] }, { visibleToRoles: ["mods"] })
				.changed,
		).toBe(false);
	});
});
