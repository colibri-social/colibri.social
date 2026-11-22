import { describe, expect, it } from "vitest";
import { notificationReason } from "./notifications";
import { createMockSource, setLatency } from "./source";

describe("mock notifications", () => {
	it("derives mentions, role mentions and replies across Spaces", async () => {
		setLatency(0);
		const source = createMockSource({ live: false });
		const first = await source.listNotifications({ limit: 100 });
		const all = [...first.items];
		let cursor = first.cursor;
		while (cursor) {
			const page = await source.listNotifications({ limit: 100, cursor });
			all.push(...page.items);
			cursor = page.cursor;
		}
		const summary = {
			total: all.length,
			mentions: all.filter(
				(entry) => entry.kind === "mention" && !entry.mentionRole,
			).length,
			roles: all.filter((entry) => !!entry.mentionRole).length,
			replies: all.filter((entry) => entry.kind === "reply").length,
			threads: all.filter((entry) => !!entry.thread).length,
			unread: all.filter((entry) => !entry.seenAt).length,
			spaces: new Set(all.map((entry) => entry.community)).size,
		};
		expect(summary.mentions).toBeGreaterThan(0);
		expect(summary.replies).toBeGreaterThan(1);
		expect(summary.roles).toBeGreaterThan(1);
		expect(summary.threads).toBeGreaterThan(0);
		expect(summary.spaces).toBe(3);
		expect(summary.unread).toBeGreaterThan(0);
		expect(summary.unread).toBeLessThan(summary.total);
		const times = all.map((entry) => Date.parse(entry.indexedAt));
		expect([...times].sort((a, b) => b - a)).toEqual(times);
		expect(
			all.every((entry) => entry.author.did !== source.world.viewerDid),
		).toBe(true);
	});

	it("ignores the viewer's own messages and unrelated ones", () => {
		const context = {
			viewer: "did:plc:me" as never,
			viewerRoles: ["mods"],
			roles: [],
		};
		const message = (author: string, extra: Record<string, unknown> = {}) =>
			({ author: { did: author }, text: "hi", ...extra }) as never;
		expect(notificationReason(message("did:plc:me"), context)).toBeUndefined();
		expect(notificationReason(message("did:plc:x"), context)).toBeUndefined();
		expect(
			notificationReason(
				message("did:plc:x", { parent: { author: { did: "did:plc:me" } } }),
				context,
			),
		).toEqual({ kind: "reply" });
		expect(
			notificationReason(
				message("did:plc:x", {
					facets: [
						{
							index: { byteStart: 0, byteEnd: 2 },
							features: [{ role: "mods" }],
						},
					],
				}),
				context,
			),
		).toEqual({ kind: "mention", mentionRole: "mods" });
	});
});
