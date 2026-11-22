import { describe, expect, it } from "vitest";
import { keepUnchanged } from "./merge";

describe("keepUnchanged", () => {
	it("returns the previous list when nothing changed", () => {
		const previous = [
			{ space: "a", name: "one", viewer: { hasUnread: false } },
			{ space: "b", name: "two", viewer: { hasUnread: true } },
		];
		const next = structuredClone(previous);
		expect(keepUnchanged(previous, next)).toBe(previous);
	});

	it("keeps unchanged rows and replaces only the changed one", () => {
		const previous = [
			{ space: "a", name: "one" },
			{ space: "b", name: "two" },
		];
		const next = [
			{ space: "a", name: "one" },
			{ space: "b", name: "renamed" },
		];
		const merged = keepUnchanged(previous, next);
		expect(merged).not.toBe(previous);
		expect(merged[0]).toBe(previous[0]);
		expect(merged[1]).toEqual({ space: "b", name: "renamed" });
	});

	it("matches rows by identity when they move or arrive", () => {
		const first = { did: "did:plc:a", roles: ["x"] };
		const second = { did: "did:plc:b", roles: [] };
		const merged = keepUnchanged(
			[first, second],
			[{ did: "did:plc:c", roles: [] }, { ...second }, { ...first }],
		);
		expect(merged[1]).toBe(second);
		expect(merged[2]).toBe(first);
		expect(merged[0]).toEqual({ did: "did:plc:c", roles: [] });
	});

	it("matches members by their actor", () => {
		const member = { actor: { did: "did:plc:a", handle: "a" }, roles: [] };
		const merged = keepUnchanged(
			[member],
			[{ actor: { did: "did:plc:a", handle: "a" }, roles: [] }],
		);
		expect(merged).toEqual([member]);
		expect(merged[0]).toBe(member);
	});

	it("keeps nested arrays that did not change", () => {
		const channels = [{ space: "c1" }, { space: "c2" }];
		const previous = [{ rkey: "cat", name: "General", channels }];
		const next = [
			{
				rkey: "cat",
				name: "Renamed",
				channels: [{ space: "c1" }, { space: "c2" }],
			},
		];
		const merged = keepUnchanged(previous, next);
		expect(merged[0]?.name).toBe("Renamed");
		expect(merged[0]?.channels).toBe(channels);
	});

	it("takes the next value when a field disappears", () => {
		const previous = { name: "a", description: "gone" } as {
			name: string;
			description?: string;
		};
		const merged = keepUnchanged(previous, { name: "a" });
		expect(merged).toEqual({ name: "a" });
	});
});
