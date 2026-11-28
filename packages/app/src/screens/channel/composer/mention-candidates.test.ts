import { describe, expect, it } from "vitest";
import { rankMembers, recentSenders } from "./mention-candidates";

const message = (did: string, bridge?: object) => {
	return { author: { did, ...(bridge ? { bridge } : {}) } };
};

describe("recentSenders", () => {
	it("lists distinct senders newest first", () => {
		const messages = ["a", "b", "a", "c", "b"].map((did) => message(did));

		expect(recentSenders(messages, { limit: 5, include: () => true })).toEqual([
			"b",
			"c",
			"a",
		]);
	});

	it("stops at the limit", () => {
		const messages = ["a", "b", "c", "d", "e", "f"].map((did) => message(did));

		expect(recentSenders(messages, { limit: 5, include: () => true })).toEqual([
			"f",
			"e",
			"d",
			"c",
			"b",
		]);
	});

	it("skips excluded and bridged authors", () => {
		const messages = [
			message("a"),
			message("me"),
			message("bridged", { remoteId: "1" }),
			message("b"),
		];

		expect(
			recentSenders(messages, {
				limit: 5,
				include: (did) => did !== "me",
			}),
		).toEqual(["b", "a"]);
	});

	it("returns nothing for an empty channel", () => {
		expect(recentSenders([], { limit: 5, include: () => true })).toEqual([]);
	});
});

describe("rankMembers", () => {
	const people = [
		{ name: "Ada Cole", handle: "ada.example" },
		{ name: "Bea", handle: "cobalt.example" },
		{ name: "Nicolette", handle: "nic.example" },
		{ name: "Colin", handle: "colin.example" },
		{ name: "Cora", handle: "cora.example" },
		{ name: "Dan", handle: "dan.example" },
	];

	const fields = {
		name: (person: (typeof people)[number]) => person.name,
		handle: (person: (typeof people)[number]) => person.handle,
	};

	it("orders name prefix, handle prefix, name substring, handle substring", () => {
		expect(rankMembers(people, "co", fields).map((p) => p.name)).toEqual([
			"Colin",
			"Cora",
			"Bea",
			"Ada Cole",
			"Nicolette",
		]);
	});

	it("matches case-insensitively", () => {
		expect(rankMembers(people, "DAN", fields).map((p) => p.name)).toEqual([
			"Dan",
		]);
	});

	it("returns nothing without a match", () => {
		expect(rankMembers(people, "zz", fields)).toEqual([]);
	});
});
