import { beforeEach, describe, expect, it, vi } from "vitest";

const preflightFetch = vi.fn();
const reportSignInFailure = vi.fn(
	async (err: unknown, _input: string, _stage: string) => err,
);

vi.mock("./auth", () => ({
	preflightFetch: (url: string) => preflightFetch(url),
	reportSignInFailure: (err: unknown, input: string, stage: string) =>
		reportSignInFailure(err, input, stage),
}));

vi.mock("../utils/appview", () => ({
	getAppViewHost: () => "https://api.colibri.social",
}));

const { normalizeHandle, resolveHandleToDid } = await import(
	"./resolve-handle"
);
const { isColibriError } = await import("../errors/error");

const respondWith = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const codeOf = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	} catch (err) {
		return isColibriError(err) ? err.code : `unexpected:${String(err)}`;
	}
	return "resolved";
};

beforeEach(() => {
	preflightFetch.mockReset();
	reportSignInFailure.mockClear();
});

describe("normalizeHandle", () => {
	it("strips a leading at sign and lowercases", () => {
		expect(normalizeHandle("  @Alice.Example.COM ")).toBe("alice.example.com");
	});
});

describe("resolveHandleToDid", () => {
	it("passes a DID straight through without a request", async () => {
		await expect(resolveHandleToDid("did:plc:abc")).resolves.toBe(
			"did:plc:abc",
		);
		expect(preflightFetch).not.toHaveBeenCalled();
	});

	it("returns the resolved DID", async () => {
		preflightFetch.mockResolvedValue(respondWith(200, { did: "did:plc:abc" }));

		await expect(resolveHandleToDid("alice.example.com")).resolves.toBe(
			"did:plc:abc",
		);
		expect(reportSignInFailure).not.toHaveBeenCalled();
	});

	it("does not report a handle the AppView could not look up", async () => {
		preflightFetch.mockResolvedValue(
			respondWith(502, {
				error: "UpstreamFailure",
				message: "Unable to resolve handle",
			}),
		);

		await expect(codeOf(resolveHandleToDid("tranquil"))).resolves.toBe(
			"HandleNotFound",
		);
		expect(reportSignInFailure).not.toHaveBeenCalled();
	});

	it("does not report a handle the AppView rejected outright", async () => {
		preflightFetch.mockResolvedValue(
			respondWith(400, { error: "InvalidRequest", message: "bad handle" }),
		);

		await expect(codeOf(resolveHandleToDid("nope"))).resolves.toBe(
			"HandleNotFound",
		);
		expect(reportSignInFailure).not.toHaveBeenCalled();
	});

	it("still reports an AppView that is broken", async () => {
		preflightFetch.mockResolvedValue(
			respondWith(500, { error: "InternalError", message: "boom" }),
		);

		await codeOf(resolveHandleToDid("alice.example.com"));
		expect(reportSignInFailure).toHaveBeenCalledTimes(1);
	});

	it("still reports a request that could not be sent", async () => {
		preflightFetch.mockRejectedValue(new TypeError("Load failed"));

		await codeOf(resolveHandleToDid("alice.example.com"));
		expect(reportSignInFailure).toHaveBeenCalledTimes(1);
	});
});
