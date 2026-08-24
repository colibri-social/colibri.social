import { describe, expect, it } from "vitest";
import { asSpaceRef, SPACE_TYPES } from "../atproto/lexicons";
import type { CategoryView, ChannelView } from "../atproto/views";
import { pickDefaultChannel } from "./default-channel";

const DID = "did:plc:abc123";

const channel = (
	rkey: string,
	options?: { canRead?: boolean; voice?: boolean; category?: string },
): ChannelView => {
	const type = options?.voice
		? SPACE_TYPES.channelVoice
		: SPACE_TYPES.channelText;

	return {
		space: asSpaceRef(`at://${DID}/space/${type}/${rkey}`),
		type,
		name: rkey,
		category: options?.category,
		viewer: { canRead: options?.canRead ?? true, canWrite: true },
	} as unknown as ChannelView;
};

const category = (rkey: string, channels: Array<ChannelView>): CategoryView =>
	({ rkey, name: rkey, channels }) as unknown as CategoryView;

describe("pickDefaultChannel", () => {
	it("follows the sidebar order rather than the flat channel list", () => {
		const top = channel("welcome", { category: "info" });
		const bottom = channel("chatter", { category: "social" });

		const picked = pickDefaultChannel({
			categories: [category("info", [top]), category("social", [bottom])],
			channels: [bottom, top],
		});

		expect(picked?.space).toBe(top.space);
	});

	it("follows the order within a category", () => {
		const first = channel("rules", { category: "info" });
		const second = channel("announcements", { category: "info" });

		const picked = pickDefaultChannel({
			categories: [category("info", [first, second])],
			channels: [second, first],
		});

		expect(picked?.space).toBe(first.space);
	});

	it("skips channels the user may not read", () => {
		const locked = channel("staff", { canRead: false, category: "info" });
		const open = channel("general", { category: "info" });

		const picked = pickDefaultChannel({
			categories: [category("info", [locked, open])],
			channels: [locked, open],
		});

		expect(picked?.space).toBe(open.space);
	});

	it("skips voice channels", () => {
		const voice = channel("lounge", { voice: true, category: "info" });
		const text = channel("general", { category: "info" });

		const picked = pickDefaultChannel({
			categories: [category("info", [voice, text])],
			channels: [voice, text],
		});

		expect(picked?.space).toBe(text.space);
	});

	it("falls back to the flat list when no category holds a candidate", () => {
		const loose = channel("general");

		const picked = pickDefaultChannel({
			categories: [category("info", [channel("staff", { canRead: false })])],
			channels: [loose],
		});

		expect(picked?.space).toBe(loose.space);
	});

	it("picks nothing when every channel is filtered out", () => {
		const locked = channel("staff", { canRead: false, category: "info" });
		const voice = channel("lounge", { voice: true, category: "info" });

		expect(
			pickDefaultChannel({
				categories: [category("info", [locked, voice])],
				channels: [locked, voice],
			}),
		).toBeUndefined();
	});

	it("picks nothing in an empty community", () => {
		expect(
			pickDefaultChannel({ categories: [], channels: [] }),
		).toBeUndefined();
	});
});
