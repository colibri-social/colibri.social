import { describe, expect, it } from "vitest";
import { APPVIEW_CODE_DESCRIPTIONS } from "./appview-codes";
import { ALL_ERROR_CODES } from "./codes";
import {
	codeForFileRejection,
	codeForOAuthError,
	copyForCode,
	describeError,
	FALLBACK_COPY,
} from "./copy";
import { ColibriError } from "./error";

describe("copyForCode", () => {
	it("has copy for every code the AppView lexicons declare", () => {
		for (const code of Object.keys(APPVIEW_CODE_DESCRIPTIONS)) {
			const copy = copyForCode(code as never);
			expect(copy, code).not.toBe(FALLBACK_COPY);
			expect(copy.title.length, code).toBeGreaterThan(0);
		}
	});

	it("never exposes the raw code as a title", () => {
		for (const code of Object.keys(APPVIEW_CODE_DESCRIPTIONS)) {
			expect(copyForCode(code as never).title).not.toBe(code);
		}
	});
});

describe("describeError", () => {
	it("prefers a field message over the generic description", () => {
		const err = new ColibriError({
			code: "InvalidRequest",
			fields: [{ field: "name", message: "Name is required." }],
		});
		expect(describeError(err).description).toBe("Name is required.");
	});

	it("keeps the curated title even when a field message is present", () => {
		const err = new ColibriError({
			code: "InvalidRequest",
			fields: [{ message: "Name is required." }],
		});
		expect(describeError(err).title).toBe(copyForCode("InvalidRequest").title);
	});

	it("never surfaces a raw thrown message as the title", () => {
		const copy = describeError(new Error("TypeError: Failed to fetch"));
		expect(copy.title).not.toContain("TypeError");
	});

	it("falls back to a human title for an unrecognised value", () => {
		expect(describeError({ weird: true }).title).toBe(FALLBACK_COPY.title);
	});
});

describe("codeForFileRejection", () => {
	it("maps every Kobalte file rejection", () => {
		expect(codeForFileRejection("TOO_MANY_FILES")).toBe("TooManyFiles");
		expect(codeForFileRejection("FILE_TOO_LARGE")).toBe("FileTooLarge");
		expect(codeForFileRejection("FILE_TOO_SMALL")).toBe("FileTooSmall");
		expect(codeForFileRejection("FILE_INVALID_TYPE")).toBe(
			"UnsupportedFileType",
		);
	});

	it("falls back for an unknown rejection", () => {
		expect(codeForFileRejection("SOMETHING_ELSE")).toBe("Unexpected");
	});
});

describe("codeForOAuthError", () => {
	it("maps the OAuth error parameters we have seen", () => {
		expect(codeForOAuthError("access_denied")).toBe("OAuthDenied");
		expect(codeForOAuthError("login_required")).toBe("ExpiredToken");
		expect(codeForOAuthError("temporarily_unavailable")).toBe(
			"OAuthProviderUnavailable",
		);
	});

	it("falls back when the provider sends something else", () => {
		expect(codeForOAuthError(null)).toBe("SignInFailed");
		expect(codeForOAuthError("server_error")).toBe("SignInFailed");
	});
});

describe("the catalog covers every code", () => {
	it("has curated copy for every code the client can produce", () => {
		const missing = ALL_ERROR_CODES.filter(
			(code) => copyForCode(code) === FALLBACK_COPY && code !== "Unexpected",
		);
		expect(missing).toEqual([]);
	});

	it("gives every code a title that is not the code itself", () => {
		for (const code of ALL_ERROR_CODES) {
			expect(copyForCode(code).title, code).not.toBe(code);
		}
	});
});
