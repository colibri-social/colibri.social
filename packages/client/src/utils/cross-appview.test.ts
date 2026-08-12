import { describe, expect, it, vi } from "vitest";

vi.mock("./appview", () => ({
	getAppViewDid: () => "did:web:mine.example",
}));

const { isForeignHub } = await import("./cross-appview");

describe("isForeignHub", () => {
	it("treats our own AppView as local", () => {
		expect(isForeignHub("did:web:mine.example")).toBe(false);
	});

	it("treats another AppView as foreign", () => {
		expect(isForeignHub("did:web:theirs.example")).toBe(true);
	});

	it("treats an unknown hub as local rather than guessing", () => {
		expect(isForeignHub("")).toBe(false);
		expect(isForeignHub(undefined)).toBe(false);
	});
});
