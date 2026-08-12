import { describe, expect, it } from "vitest";
import { ColibriError } from "../errors/error";
import { decideCommunityExit } from "./community-exit";

const gone = new ColibriError({ code: "NotFound" });
const transient = new ColibriError({ code: "Unreachable" });

describe("decideCommunityExit", () => {
	it("waits while the fetch is still in flight", () => {
		expect(decideCommunityExit(true, undefined, false)).toBe("stay");
		expect(decideCommunityExit(true, gone, true)).toBe("stay");
	});

	it("stays put on a transient failure with nothing to show", () => {
		expect(decideCommunityExit(false, transient, false)).toBe("stay");
	});

	it("stays put on a transient failure that interrupted a good payload", () => {
		expect(decideCommunityExit(false, transient, true)).toBe("stay");
	});

	it("leaves when the community is gone", () => {
		expect(decideCommunityExit(false, gone, false)).toBe("gone");
	});

	it("leaves when the community is gone even though we cached it", () => {
		expect(decideCommunityExit(false, gone, true)).toBe("gone");
	});

	it("treats a forbidden community as gone", () => {
		const forbidden = new ColibriError({ code: "Forbidden" });

		expect(decideCommunityExit(false, forbidden, true)).toBe("gone");
	});

	it("renders the payload when the fetch succeeded", () => {
		expect(decideCommunityExit(false, undefined, true)).toBe("stay");
	});

	it("leaves when the fetch settled with neither payload nor error", () => {
		expect(decideCommunityExit(false, undefined, false)).toBe("leave");
	});

	it("leaves on a failure it cannot classify and has nothing to show", () => {
		expect(decideCommunityExit(false, new Error("boom"), false)).toBe("leave");
	});
});
