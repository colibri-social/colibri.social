import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();

vi.mock("../../../../../errors/report", () => ({
	reportError: (err: unknown, options: unknown) => reportError(err, options),
	setDiagnosticsProvider: () => {},
}));

vi.mock("../../../../session-health", () => ({
	sessionDead: () => false,
	sessionDeadCode: () => undefined,
	noteScopesRejected: () => {},
	noteAuthFailure: () => {},
}));

const { getChannelView } = await import("./getChannelView");

const channel = "at://did:plc:example/social.colibri.channel.text/abc";

const throwing = (err: unknown) => async (): Promise<Response> => {
	throw err;
};

const wrapped = (cause: unknown) =>
	throwing(new Error("Request timed out", { cause }));

beforeEach(() => reportError.mockClear());

describe("channel.getChannelView", () => {
	it("does not report a view the browser could not fetch at all", async () => {
		const res = await getChannelView(
			throwing(
				new TypeError("NetworkError when attempting to fetch resource."),
			),
			channel,
			50,
		);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("NetworkFailed");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("does not report a view whose transport wrapped a network failure", async () => {
		const res = await getChannelView(
			wrapped(new TypeError("NetworkError when attempting to fetch resource.")),
			channel,
			50,
		);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("NetworkFailed");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("does not report a view that timed out", async () => {
		const res = await getChannelView(
			wrapped(new DOMException("Request timed out", "TimeoutError")),
			channel,
			50,
		);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("Timeout");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("still reports an AppView that is broken", async () => {
		const res = await getChannelView(
			async () =>
				new Response(
					JSON.stringify({ error: "InternalError", message: "boom" }),
					{ status: 500, headers: { "content-type": "application/json" } },
				),
			channel,
			50,
		);

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});
});
