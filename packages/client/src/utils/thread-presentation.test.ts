import { describe, expect, it } from "vitest";
import {
	invertPresentation,
	presentationFromSearch,
	threadHref,
} from "./thread-presentation";

describe("presentationFromSearch", () => {
	it("reads split off the search param on desktop", () => {
		expect(presentationFromSearch("1", false)).toBe("split");
	});

	it("falls back to full without the param", () => {
		expect(presentationFromSearch(undefined, false)).toBe("full");
	});

	it("is always full on mobile, where there is no room to split", () => {
		expect(presentationFromSearch("1", true)).toBe("full");
	});
});

describe("invertPresentation", () => {
	it("swaps the two modes", () => {
		expect(invertPresentation("split")).toBe("full");
		expect(invertPresentation("full")).toBe("split");
	});
});

describe("threadHref", () => {
	const path = "/app/c/did:plc:x/social.colibri.beta.channel.text/general/t/3l";

	it("carries the split mode in the search", () => {
		expect(threadHref(path, "split")).toBe(`${path}?split=1`);
	});

	it("leaves the path bare for full", () => {
		expect(threadHref(path, "full")).toBe(path);
	});
});
