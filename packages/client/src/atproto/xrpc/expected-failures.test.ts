import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();

vi.mock("../../errors/report", () => ({
	reportError: (err: unknown, options: unknown) => reportError(err, options),
	setDiagnosticsProvider: () => {},
}));

vi.mock("../session-health", () => ({
	sessionDead: () => false,
	sessionDeadCode: () => undefined,
	noteScopesRejected: () => {},
	noteAuthFailure: () => {},
}));

const { getMetadata } = await import("./social/colibri/embed/getMetadata");
const { getData } = await import("./social/colibri/community/getData");
const { listUnreadStatus } = await import(
	"./social/colibri/channel/listUnreadStatus"
);
const { listCommunities } = await import(
	"./social/colibri/actor/listCommunities"
);

const respondWith =
	(status: number, body: unknown) => async (): Promise<Response> =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});

const upstreamFailure = respondWith(502, {
	error: "UpstreamFailure",
	message:
		"upstream error: dns lookup failed: failed to lookup address information",
});

beforeEach(() => reportError.mockClear());

describe("embed.getMetadata", () => {
	it("does not report a link whose site refused to answer", async () => {
		const res = await getMetadata(upstreamFailure, "https://example.invalid/a");

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("does not report a link the AppView could not find", async () => {
		const res = await getMetadata(
			respondWith(404, { error: "NotFound", message: "no metadata" }),
			"https://example.invalid/b",
		);

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("still reports an AppView that is broken", async () => {
		const res = await getMetadata(
			respondWith(500, { error: "InternalError", message: "boom" }),
			"https://example.invalid/c",
		);

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});
});

describe("community.getData", () => {
	it("does not report a community that no longer exists", async () => {
		const res = await getData(
			respondWith(404, { error: "NotFound", message: "Community not found." }),
			"at://did:plc:example/social.colibri.community/abc",
		);

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("still reports a community the caller may not read", async () => {
		const res = await getData(
			respondWith(403, { error: "Forbidden", message: "not a member" }),
			"at://did:plc:example/social.colibri.community/abc",
		);

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});
});

const throwing = (err: unknown) => async (): Promise<Response> => {
	throw err;
};

const timedOut = throwing(new DOMException("timed out", "TimeoutError"));
const connectionRefused = throwing(
	new TypeError("NetworkError when attempting to fetch resource."),
);

describe("channel.listUnreadStatus", () => {
	const community = "at://did:plc:example/social.colibri.community/abc";

	it("does not report a poll that timed out on a flaky connection", async () => {
		const res = await listUnreadStatus(timedOut, community);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("Timeout");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("does not report a poll the device could not send at all", async () => {
		const res = await listUnreadStatus(connectionRefused, community);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("NetworkFailed");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("still reports an AppView that answered with a broken body", async () => {
		const res = await listUnreadStatus(
			respondWith(500, { error: "InternalError", message: "boom" }),
			community,
		);

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});
});

describe("actor.listCommunities", () => {
	it("does not report a request that timed out on a flaky connection", async () => {
		const res = await listCommunities(timedOut);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("Timeout");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("does not report an unreachable PDS", async () => {
		const res = await listCommunities(connectionRefused);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("NetworkFailed");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("still reports an AppView that is broken", async () => {
		const res = await listCommunities(
			respondWith(500, { error: "InternalError", message: "boom" }),
		);

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});
});
