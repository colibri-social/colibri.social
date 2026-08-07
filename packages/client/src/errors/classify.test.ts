import { afterEach, describe, expect, it, vi } from "vitest";
import {
	classifyResponse,
	classifyThrown,
	isConnectivityError,
	isRecordNotFound,
	isStorageFailure,
	parseFieldProblems,
	parseRetryAfterMs,
	readEnvelope,
	retryability,
	statusOf,
} from "./classify";
import { ColibriError } from "./error";

afterEach(() => vi.unstubAllGlobals());

const offline = (value: boolean) =>
	vi.stubGlobal("navigator", { onLine: !value });

describe("readEnvelope", () => {
	it("reads the atproto error envelope", () => {
		expect(readEnvelope('{"error":"Forbidden","message":"nope"}')).toEqual({
			code: "Forbidden",
			message: "nope",
		});
	});

	it("treats a non-JSON body as a bare message", () => {
		expect(readEnvelope("upstream exploded")).toEqual({
			message: "upstream exploded",
		});
	});

	it("treats malformed JSON as a bare message", () => {
		expect(readEnvelope('{"error":')).toEqual({ message: '{"error":' });
	});

	it("returns nothing for an empty body", () => {
		expect(readEnvelope("   ")).toEqual({});
	});
});

describe("classifyResponse", () => {
	it("prefers the declared code over the status", () => {
		const err = classifyResponse({
			status: 400,
			body: '{"error":"NotEnabled","message":"off"}',
		});
		expect(err.code).toBe("NotEnabled");
		expect(err.serverMessage).toBe("off");
	});

	it("falls back to the status when the code is unknown to the lexicons", () => {
		const err = classifyResponse({
			status: 403,
			body: '{"error":"SomethingNew"}',
		});
		expect(err.code).toBe("Forbidden");
		expect(err.context.unknownCode).toBe("SomethingNew");
	});

	it("maps statuses that carry no envelope", () => {
		expect(classifyResponse({ status: 401, body: "" }).code).toBe(
			"AuthRequired",
		);
		expect(classifyResponse({ status: 404, body: "" }).code).toBe("NotFound");
		expect(classifyResponse({ status: 429, body: "" }).code).toBe(
			"RateLimited",
		);
		expect(classifyResponse({ status: 500, body: "" }).code).toBe(
			"InternalError",
		);
		expect(classifyResponse({ status: 502, body: "" }).code).toBe(
			"UpstreamFailure",
		);
	});

	it("marks permission failures as not retryable", () => {
		expect(classifyResponse({ status: 403, body: "" }).retryable).toBe(false);
		expect(classifyResponse({ status: 400, body: "" }).retryable).toBe(false);
	});

	it("marks rate limits and server failures as retryable", () => {
		expect(classifyResponse({ status: 429, body: "" }).retryable).toBe(true);
		expect(classifyResponse({ status: 503, body: "" }).retryable).toBe(true);
	});

	it("carries the method through for reporting", () => {
		const err = classifyResponse({
			status: 500,
			body: "",
			method: "social.colibri.community.getData",
		});
		expect(err.method).toBe("social.colibri.community.getData");
	});
});

describe("parseRetryAfterMs", () => {
	it("reads a delay in seconds", () => {
		expect(parseRetryAfterMs("30", 0)).toBe(30_000);
	});

	it("reads an HTTP date", () => {
		const now = Date.parse("2026-01-01T00:00:00Z");
		expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:10 GMT", now)).toBe(
			10_000,
		);
	});

	it("never returns a negative delay for a past date", () => {
		const now = Date.parse("2026-01-01T00:00:30Z");
		expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:10 GMT", now)).toBe(0);
	});

	it("is undefined when absent or unparseable", () => {
		expect(parseRetryAfterMs(null, 0)).toBeUndefined();
		expect(parseRetryAfterMs("", 0)).toBeUndefined();
		expect(parseRetryAfterMs("soon", 0)).toBeUndefined();
	});
});

describe("parseFieldProblems", () => {
	it("extracts field messages from an AppView validation failure", () => {
		const message =
			'Failed to validate: [{"path":["name"],"message":"Required"},{"path":["description"],"message":"Too long"}]';
		expect(parseFieldProblems(message)).toEqual([
			{ field: "name", message: "Required" },
			{ field: "description", message: "Too long" },
		]);
	});

	it("returns nothing for a message that is not a validation failure", () => {
		expect(parseFieldProblems("Forbidden")).toEqual([]);
	});

	it("does not throw on malformed validation payloads", () => {
		expect(parseFieldProblems("Failed to validate: not-json")).toEqual([]);
	});

	it("returns nothing when given no message", () => {
		expect(parseFieldProblems(undefined)).toEqual([]);
	});
});

describe("classifyThrown", () => {
	it("passes a ColibriError through untouched", () => {
		const original = new ColibriError({ code: "Forbidden" });
		expect(classifyThrown(original)).toBe(original);
	});

	it("reports offline before anything else", () => {
		offline(true);
		expect(classifyThrown(new TypeError("Failed to fetch")).code).toBe(
			"Offline",
		);
	});

	it("treats a bare fetch TypeError as a dropped connection", () => {
		offline(false);
		expect(classifyThrown(new TypeError("Failed to fetch")).code).toBe(
			"NetworkFailed",
		);
	});

	it("recognises a stalled local storage", () => {
		offline(false);
		const err = new Error("IndexedDB unavailable");
		expect(classifyThrown(err).code).toBe("StorageStalled");
	});

	it("uses a status carried on the thrown value", () => {
		offline(false);
		const err = Object.assign(new Error("nope"), { status: 403 });
		expect(classifyThrown(err).code).toBe("Forbidden");
	});

	it("falls back to Unexpected and keeps the message", () => {
		offline(false);
		expect(classifyThrown(new Error("boom")).message).toBe("boom");
		expect(classifyThrown(new Error("boom")).code).toBe("Unexpected");
	});

	it("sees through a wrapper that hides a fetch failure in cause", () => {
		offline(false);
		const wrapped = new Error("Failed to fetch (pds.example.com)", {
			cause: new TypeError("Failed to fetch"),
		});
		wrapped.name = "FetchRequestError";

		const classified = classifyThrown(wrapped);

		expect(classified.code).toBe("NetworkFailed");
		expect(classified.message).toBe("Failed to fetch (pds.example.com)");
	});

	it("sees through a wrapper that hides an abort in cause", () => {
		offline(false);
		const abort = new Error("aborted");
		abort.name = "AbortError";

		expect(classifyThrown(new Error("wrapped", { cause: abort })).code).toBe(
			"Timeout",
		);
	});

	it("prefers a status on the wrapper over a cause shape", () => {
		offline(false);
		const wrapped = Object.assign(
			new Error("nope", { cause: new TypeError() }),
			{
				status: 403,
			},
		);

		expect(classifyThrown(wrapped).code).toBe("Forbidden");
	});

	it("survives a cause that points back at itself", () => {
		offline(false);
		const looped: { message: string; cause?: unknown } = { message: "loop" };
		looped.cause = looped;

		expect(classifyThrown(looped).code).toBe("Unexpected");
	});

	it("treats a cross-realm TypeError as a dropped connection", () => {
		offline(false);
		const foreign = { name: "TypeError", message: "Failed to fetch" };

		expect(classifyThrown(foreign).code).toBe("NetworkFailed");
	});

	it("stringifies a thrown non-Error", () => {
		offline(false);
		expect(classifyThrown("canceled").message).toBe("canceled");
	});
});

describe("isConnectivityError", () => {
	it("recognises a bare fetch TypeError", () => {
		expect(isConnectivityError(new TypeError("Failed to fetch"))).toBe(true);
	});

	it("recognises a fetch TypeError hidden behind a wrapper", () => {
		const wrapped = new Error("Failed to fetch (pds.example.com)", {
			cause: new TypeError("Failed to fetch"),
		});
		wrapped.name = "FetchRequestError";

		expect(isConnectivityError(wrapped)).toBe(true);
	});

	it("stays false for an unrelated failure", () => {
		expect(isConnectivityError(new Error("boom"))).toBe(false);
	});
});

describe("statusOf", () => {
	it("reads a status off a duck-typed error", () => {
		expect(statusOf({ status: 429 })).toBe(429);
	});

	it("reads a status off a ColibriError", () => {
		expect(statusOf(new ColibriError({ code: "NotFound", status: 404 }))).toBe(
			404,
		);
	});

	it("is undefined when there is no status", () => {
		expect(statusOf(new Error("boom"))).toBeUndefined();
	});
});

describe("isStorageFailure", () => {
	it("matches the storage error names the OAuth client throws", () => {
		const named = new Error("nope");
		named.name = "DBUnavailableError";
		expect(isStorageFailure(named)).toBe(true);
	});

	it("does not match unrelated errors", () => {
		expect(isStorageFailure(new Error("nope"))).toBe(false);
	});
});

describe("retryability", () => {
	it("retries while offline even for a terminal code", () => {
		offline(true);
		expect(retryability(new ColibriError({ code: "Forbidden" }))).toBe("retry");
	});

	it("gives up on a permission failure when online", () => {
		offline(false);
		expect(retryability(new ColibriError({ code: "Forbidden" }))).toBe(
			"terminal",
		);
	});

	it("retries a rate limit when online", () => {
		offline(false);
		expect(retryability(new ColibriError({ code: "RateLimited" }))).toBe(
			"retry",
		);
	});
});

describe("isRecordNotFound", () => {
	it("recognises the atproto error code", () => {
		expect(isRecordNotFound({ error: "RecordNotFound" })).toBe(true);
	});

	it("recognises the message the PDS returns", () => {
		expect(isRecordNotFound(new Error("Could not locate record: at://x"))).toBe(
			true,
		);
	});

	it("recognises a 404", () => {
		expect(isRecordNotFound({ status: 404 })).toBe(true);
	});

	it("does not treat a network failure as a missing record", () => {
		expect(isRecordNotFound(new TypeError("Failed to fetch"))).toBe(false);
	});

	it("does not treat an auth failure as a missing record", () => {
		expect(isRecordNotFound({ status: 401, error: "AuthRequired" })).toBe(
			false,
		);
	});
});

describe("classifyThrown gives every value a code", () => {
	it("never leaves a code undefined, which surfaces would hide", () => {
		const values: Array<unknown> = [
			new Error("boom"),
			new TypeError("Failed to fetch"),
			"canceled",
			42,
			null,
			undefined,
			{ status: 500 },
		];

		for (const value of values) {
			offline(false);
			expect(classifyThrown(value).code, String(value)).toBeTruthy();
		}
	});
});
