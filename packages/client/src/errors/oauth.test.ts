import { describe, expect, it } from "vitest";
import { describeError } from "./copy";
import { ColibriError } from "./error";
import {
	classifyOAuthError,
	classifyOAuthParams,
	codeForOAuthError,
	isSignInDenial,
	readOAuthFailure,
} from "./oauth";

const DENIED =
	"state=8PfoBbK-C1U7CF0uS8qCUw&iss=https%3A%2F%2Fcolibri.social&error=access_denied&error_description=The+user+rejected+the+request";

describe("classifyOAuthParams", () => {
	it("classifies the denial a provider sends when someone declines", () => {
		const failure = classifyOAuthParams(new URLSearchParams(DENIED));

		expect(failure.code).toBe("OAuthDenied");
		expect(failure.context.oauthError).toBe("access_denied");
		expect(failure.context.issuer).toBe("https://colibri.social");
	});

	it("never lets the provider's wording become what the user reads", () => {
		const copy = describeError(
			classifyOAuthParams(new URLSearchParams(DENIED)),
		);

		expect(copy.title).not.toContain("rejected the request");
		expect(copy.description).not.toContain("rejected the request");
		expect(copy.title).toBe("You declined the sign-in request.");
	});

	it("keeps the provider's wording for diagnostics only", () => {
		const failure = classifyOAuthParams(new URLSearchParams(DENIED));

		expect(failure.serverMessage).toBe("The user rejected the request");
	});

	it("falls back to a generic sign-in failure for a code we don't map", () => {
		const failure = classifyOAuthParams(
			new URLSearchParams("error=something_new"),
		);

		expect(failure.code).toBe("SignInFailed");
		expect(failure.context.oauthError).toBe("something_new");
	});

	it("classifies an empty callback as a generic sign-in failure", () => {
		expect(classifyOAuthParams(new URLSearchParams("")).code).toBe(
			"SignInFailed",
		);
	});
});

describe("codeForOAuthError", () => {
	it("separates the user declining from everything else", () => {
		expect(codeForOAuthError("access_denied")).toBe("OAuthDenied");
	});

	it("maps the codes that mean the provider wants interaction", () => {
		for (const code of [
			"login_required",
			"consent_required",
			"interaction_required",
			"account_selection_required",
		]) {
			expect(codeForOAuthError(code), code).toBe("OAuthInteractionRequired");
		}
	});

	it("maps the codes that mean our request was rejected", () => {
		for (const code of [
			"invalid_request",
			"invalid_client",
			"unauthorized_client",
			"invalid_scope",
			"unsupported_response_type",
			"invalid_client_metadata",
		]) {
			expect(codeForOAuthError(code), code).toBe("OAuthConfigRejected");
		}
	});

	it("maps the codes that mean the provider is struggling", () => {
		expect(codeForOAuthError("server_error")).toBe("OAuthProviderUnavailable");
		expect(codeForOAuthError("temporarily_unavailable")).toBe(
			"OAuthProviderUnavailable",
		);
	});

	it("treats a spent authorization code as an expired attempt", () => {
		expect(codeForOAuthError("invalid_grant")).toBe("OAuthGrantExpired");
	});

	it("falls back when there is no code at all", () => {
		expect(codeForOAuthError(null)).toBe("SignInFailed");
		expect(codeForOAuthError(undefined)).toBe("SignInFailed");
		expect(codeForOAuthError("")).toBe("SignInFailed");
	});
});

describe("classifyOAuthError", () => {
	it("reads a thrown callback error by its params, not its message", () => {
		const err = Object.assign(new Error("The user rejected the request"), {
			params: new URLSearchParams(DENIED),
		});

		expect(classifyOAuthError(err)?.code).toBe("OAuthDenied");
	});

	it("reads a thrown token-response error by its payload", () => {
		const err = Object.assign(new Error("Token request failed"), {
			error: "invalid_grant",
			errorDescription: "The authorization code has expired",
			status: 400,
		});

		const failure = classifyOAuthError(err);
		expect(failure?.code).toBe("OAuthGrantExpired");
		expect(failure?.status).toBe(400);
	});

	it("leaves an already classified error alone", () => {
		const err = new ColibriError({ code: "StorageStalled" });
		expect(classifyOAuthError(err)).toBe(err);
	});

	it("declines values that carry no OAuth failure, so callers can fall back", () => {
		expect(classifyOAuthError(new Error("boom"))).toBeUndefined();
		expect(
			classifyOAuthError(new TypeError("Failed to fetch")),
		).toBeUndefined();
		expect(classifyOAuthError(undefined)).toBeUndefined();
		expect(classifyOAuthError("access_denied")).toBeUndefined();
	});

	it("ignores a non-string error field", () => {
		expect(readOAuthFailure({ error: 500 })).toBeUndefined();
	});
});

describe("isSignInDenial", () => {
	it("is true only for a declined request", () => {
		expect(
			isSignInDenial(classifyOAuthParams(new URLSearchParams(DENIED))),
		).toBe(true);
		expect(
			isSignInDenial(
				classifyOAuthParams(new URLSearchParams("error=server_error")),
			),
		).toBe(false);
		expect(isSignInDenial(new Error("access_denied"))).toBe(false);
	});
});
