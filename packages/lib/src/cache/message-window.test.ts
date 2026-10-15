import { describe, expect, it } from "vitest";
import { createLru } from "./lru.js";
import {
	buildMessageWindow,
	isWindowPaintable,
	MESSAGE_WINDOW_TTL_MS,
	refreshMessageWindow,
} from "./message-window.js";

const messages = (...rkeys: string[]) =>
	rkeys.map((rkey) => ({ rkey, text: rkey }));
const rkeys = (list: { rkey: string }[]) => list.map((entry) => entry.rkey);

describe("buildMessageWindow", () => {
	it("keeps the newest messages and points the cursor at the oldest kept", () => {
		const window = buildMessageWindow(messages("1", "2", "3", "4"), {
			space: "s",
			hasMore: false,
			now: 10,
			limit: 2,
		});
		expect(rkeys(window.messages)).toEqual(["3", "4"]);
		expect(window.cursor).toBe("3");
		expect(window.hasMore).toBe(true);
	});

	it("keeps the server cursor when nothing was trimmed", () => {
		const window = buildMessageWindow(messages("1", "2"), {
			space: "s",
			hasMore: true,
			cursor: "1",
			now: 10,
		});
		expect(window.cursor).toBe("1");
	});
});

describe("isWindowPaintable", () => {
	it("refuses empty or expired windows", () => {
		const window = buildMessageWindow(messages("1"), {
			space: "s",
			hasMore: false,
			now: 0,
		});
		expect(isWindowPaintable(window, 1)).toBe(true);
		expect(isWindowPaintable(window, MESSAGE_WINDOW_TTL_MS + 1)).toBe(false);
		expect(isWindowPaintable({ ...window, messages: [] }, 1)).toBe(false);
	});
});

describe("refreshMessageWindow", () => {
	it("adds newer messages and keeps the older cached ones", () => {
		const result = refreshMessageWindow(
			messages("1", "2", "3"),
			{ items: messages("5", "4", "3"), cursor: "3" },
			{ pageSize: 3, cachedCursor: "1" },
		);
		expect(rkeys(result.messages)).toEqual(["1", "2", "3", "4", "5"]);
		expect(result.cursor).toBe("1");
		expect(result.replaced).toBe(false);
	});

	it("drops cached messages that were deleted inside the fetched range", () => {
		const result = refreshMessageWindow(
			messages("1", "2", "3", "4"),
			{ items: messages("4", "2"), cursor: "2" },
			{ pageSize: 2, cachedCursor: "1" },
		);
		expect(rkeys(result.messages)).toEqual(["1", "2", "4"]);
	});

	it("drops everything missing when the page covers the whole history", () => {
		const result = refreshMessageWindow(
			messages("1", "2", "3"),
			{ items: messages("3", "1") },
			{ pageSize: 50 },
		);
		expect(rkeys(result.messages)).toEqual(["1", "3"]);
		expect(result.cursor).toBeUndefined();
	});

	it("replaces the window when the newest page doesn't reach the cache", () => {
		const result = refreshMessageWindow(
			messages("1", "2"),
			{ items: messages("9", "8"), cursor: "8" },
			{ pageSize: 2, cachedCursor: "1" },
		);
		expect(rkeys(result.messages)).toEqual(["8", "9"]);
		expect(result.cursor).toBe("8");
		expect(result.replaced).toBe(true);
	});

	it("keeps live messages that arrived after the page was fetched", () => {
		const result = refreshMessageWindow(
			messages("1", "2", "7"),
			{ items: messages("2", "1") },
			{ pageSize: 50 },
		);
		expect(rkeys(result.messages)).toEqual(["1", "2", "7"]);
	});

	it("reuses the fetched objects so keys stay stable", () => {
		const page = messages("2", "1");
		const result = refreshMessageWindow(
			messages("1", "2"),
			{ items: page },
			{
				pageSize: 50,
			},
		);
		expect(result.messages).toContain(page[0]);
	});
});

describe("createLru", () => {
	it("evicts the least recently used entry", () => {
		const lru = createLru<number>(2);
		lru.remember("a", 1);
		lru.remember("b", 2);
		lru.recall("a");
		expect(lru.remember("c", 3)).toEqual(["b"]);
		expect(lru.keys()).toEqual(["a", "c"]);
	});
});
