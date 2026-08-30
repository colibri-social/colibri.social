import { describe, expect, it } from "vitest";
import { isDeclinedByUser } from "./sentry-filter";

const denial = {
	exception: { values: [{ type: "NotAllowedError" }] },
};

describe("isDeclinedByUser", () => {
	it("drops a bare permission denial", () => {
		expect(isDeclinedByUser(denial)).toBe(true);
	});

	it("keeps a permission denial raised while joining voice", () => {
		expect(
			isDeclinedByUser({ ...denial, tags: { "voice.stage": "mic" } }),
		).toBe(false);
	});

	it("keeps anything that is not a permission denial", () => {
		expect(
			isDeclinedByUser({ exception: { values: [{ type: "TypeError" }] } }),
		).toBe(false);
	});

	it("keeps an event with no exception at all", () => {
		expect(isDeclinedByUser({})).toBe(false);
	});
});
