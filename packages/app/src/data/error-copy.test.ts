import { ALL_ERROR_CODES, ColibriError } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { APP_ERROR_COPY, copyForCode, describeError } from "./error-copy";

const JARGON =
	/\b(appview|pds|did|xrpc|oauth|token|scope|session|credential|frame|server|lexicon|delegation|blob|upstream|community|communities|identifier|handle|we've been notified)\b/i;

describe("app error copy", () => {
	it("has its own copy for every error code", () => {
		for (const code of ALL_ERROR_CODES) {
			expect(APP_ERROR_COPY[code], code).toBeDefined();
			expect(copyForCode(code).title.length, code).toBeGreaterThan(0);
		}
	});

	it("stays free of technical jargon", () => {
		for (const code of ALL_ERROR_CODES) {
			const { title, description } = copyForCode(code);
			expect(title, code).not.toMatch(JARGON);
			expect(description ?? "", code).not.toMatch(JARGON);
		}
	});

	it("never shows the raw code", () => {
		for (const code of ALL_ERROR_CODES) {
			expect(copyForCode(code).title).not.toContain(code);
		}
	});

	it("uses the app catalog when describing errors", () => {
		const copy = describeError(new ColibriError({ code: "NetworkFailed" }));
		expect(copy.title).toBe("Can't connect right now");
	});
});
