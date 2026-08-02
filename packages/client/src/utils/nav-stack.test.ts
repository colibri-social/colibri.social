import { describe, expect, it } from "vitest";
import { applyNavEntry } from "./nav-stack";

describe("applyNavEntry", () => {
	it("appends a pushed entry and moves to it", () => {
		expect(applyNavEntry(["/a"], 0, "/b", true)).toEqual({
			stack: ["/a", "/b"],
			index: 1,
		});
	});

	it("steps back when the entry matches the previous one", () => {
		expect(applyNavEntry(["/a", "/b"], 1, "/a", false)).toEqual({
			stack: ["/a", "/b"],
			index: 0,
		});
	});

	it("steps forward when the entry matches the next one", () => {
		expect(applyNavEntry(["/a", "/b"], 0, "/b", false)).toEqual({
			stack: ["/a", "/b"],
			index: 1,
		});
	});

	it("overwrites the current entry on a replace", () => {
		expect(applyNavEntry(["/a", "/b"], 1, "/c", false)).toEqual({
			stack: ["/a", "/c"],
			index: 1,
		});
	});

	it("truncates the forward entries when pushing after going back", () => {
		expect(applyNavEntry(["/a", "/b", "/c"], 0, "/d", true)).toEqual({
			stack: ["/a", "/d"],
			index: 1,
		});
	});

	it("keeps a replace from inventing a forward entry", () => {
		expect(applyNavEntry(["/a"], 0, "/b", false)).toEqual({
			stack: ["/b"],
			index: 0,
		});
	});

	it("prefers the back step over treating a repeat as a push", () => {
		expect(applyNavEntry(["/a", "/b", "/c"], 2, "/b", false)).toEqual({
			stack: ["/a", "/b", "/c"],
			index: 1,
		});
	});
});
