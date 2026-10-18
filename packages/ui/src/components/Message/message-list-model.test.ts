import { describe, expect, it } from "vitest";
import {
	appendedCount,
	buildMessageEntries,
	classifyChange,
	describeArrivals,
} from "./message-list-model";

const message = (id: string, author: string, minutes: number, day = 7) => ({
	id,
	author,
	timestamp: new Date(2026, 9, day, 9, minutes),
});

const key = (entry: { id: string }) => entry.id;

describe("classifyChange", () => {
	it("detects no change", () => {
		expect(classifyChange(["a", "b"], ["a", "b"])).toBe("none");
		expect(classifyChange([], [])).toBe("none");
	});

	it("detects appends and prepends", () => {
		expect(classifyChange(["a", "b"], ["a", "b", "c"])).toBe("append");
		expect(classifyChange(["b", "c"], ["a", "b", "c"])).toBe("prepend");
	});

	it("treats a first load and a disjoint window as a reset", () => {
		expect(classifyChange([], ["a"])).toBe("reset");
		expect(classifyChange(["a"], [])).toBe("reset");
		expect(classifyChange(["a", "b"], ["x", "y", "z"])).toBe("reset");
	});

	it("treats removals, edits in the middle and two-sided growth as mixed", () => {
		expect(classifyChange(["a", "b", "c"], ["a", "c"])).toBe("mixed");
		expect(classifyChange(["b", "c"], ["a", "b", "c", "d"])).toBe("mixed");
		expect(classifyChange(["a", "b"], ["b", "a"])).toBe("mixed");
	});

	it("counts appended messages", () => {
		expect(appendedCount(["a"], ["a", "b", "c"])).toBe(2);
		expect(appendedCount(["a", "b"], ["a"])).toBe(0);
	});
});

describe("buildMessageEntries", () => {
	it("numbers positions and keys entries", () => {
		const entries = buildMessageEntries(
			[message("a", "lou", 0), message("b", "kris", 1)],
			key,
		);
		expect(entries.map((entry) => [entry.key, entry.position])).toEqual([
			["a", 1],
			["b", 2],
		]);
	});

	it("starts a new group after the unread divider", () => {
		const entries = buildMessageEntries(
			[message("a", "lou", 0), message("b", "lou", 1), message("c", "lou", 2)],
			key,
			"a",
		);
		expect(entries.map((entry) => entry.unreadStart)).toEqual([
			false,
			true,
			false,
		]);
		expect(entries[0]?.hasContinuation).toBe(false);
		expect(entries[1]?.continuation).toBe(false);
		expect(entries[2]?.continuation).toBe(true);
	});

	it("shows no unread divider after the newest message or an unknown key", () => {
		const messages = [message("a", "lou", 0), message("b", "lou", 1)];
		expect(
			buildMessageEntries(messages, key, "b").some(
				(entry) => entry.unreadStart,
			),
		).toBe(false);
		expect(
			buildMessageEntries(messages, key, "zz").some(
				(entry) => entry.unreadStart,
			),
		).toBe(false);
	});

	it("marks day boundaries", () => {
		const entries = buildMessageEntries(
			[message("a", "lou", 0, 6), message("b", "lou", 1, 7)],
			key,
		);
		expect(entries.map((entry) => entry.newDay)).toEqual([false, true]);
		expect(entries[1]?.continuation).toBe(false);
	});
});

describe("describeArrivals", () => {
	it("names a single author", () => {
		expect(describeArrivals(["Kris"])).toBe("New message from Kris");
		expect(describeArrivals(["Kris", "Kris"])).toBe("2 new messages from Kris");
	});

	it("falls back to a count", () => {
		expect(describeArrivals(["Kris", "Lou", "Kris"])).toBe("3 new messages");
		expect(describeArrivals([undefined])).toBe("New message");
		expect(describeArrivals([undefined, undefined])).toBe("2 new messages");
	});
});
