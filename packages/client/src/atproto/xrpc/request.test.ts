import { Client } from "@atproto/lex-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();

vi.mock("../../errors/report", () => ({
	reportError: (err: unknown, options: unknown) => reportError(err, options),
}));

let dead = false;
let deadCode: string | undefined;

const noteScopesRejected = vi.fn();

vi.mock("../session-health", () => ({
	sessionDead: () => dead,
	sessionDeadCode: () => deadCode,
	noteScopesRejected: (ctx: unknown) => noteScopesRejected(ctx),
}));

const { call } = await import("./request");
const { colibri } = await import("../lexicons");

const method = colibri.channel.listUnreadStatus.main;
const params = { params: { community: "did:plc:community" } };

const clientThat = (
	handler: (path: string, init: RequestInit) => Promise<Response>,
): Client =>
	new Client({
		did: "did:plc:viewer" as never,
		fetchHandler: (path, init) => handler(path, init),
	});

const respondWith = (status: number, body: string, headers?: HeadersInit) =>
	clientThat(
		async () =>
			new Response(body, {
				status,
				headers: { "content-type": "application/json", ...headers },
			}),
	);

const envelope = (error: string, message: string) =>
	JSON.stringify({ error, message });

const forbidden = () =>
	respondWith(
		403,
		envelope("Forbidden", "caller is not a member of this community"),
	);

const ok = () => respondWith(200, JSON.stringify({ statuses: [] }));

beforeEach(() => {
	reportError.mockClear();
	noteScopesRejected.mockClear();
	dead = false;
	deadCode = undefined;
});

describe("call", () => {
	it("returns the validated body on success", async () => {
		const res = await call(ok(), method, params);

		expect(res.ok).toBe(true);
		if (res.ok) expect(res.data).toEqual({ statuses: [] });
	});

	it("does not report a failure the caller declared as expected", async () => {
		const res = await call(forbidden(), method, params, {
			expected: ["Forbidden"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("reports a failure the caller did not declare", async () => {
		const res = await call(forbidden(), method, params, {
			expected: ["InvalidRequest"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});

	it("classifies the envelope code even when the status disagrees", async () => {
		const client = respondWith(
			400,
			envelope("ChannelNotFound", "no channel matches that space"),
		);
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("ChannelNotFound");
	});

	it("keeps an undeclared envelope code as diagnostic context", async () => {
		const client = respondWith(400, envelope("SomethingNew", "who knows"));
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error.code).toBe("InvalidRequest");
			expect(res.error.context.unknownCode).toBe("SomethingNew");
		}
	});

	it("tells session health when the server says a scope is missing", async () => {
		const client = respondWith(
			403,
			envelope("ScopeMissingError", "missing space scope"),
		);
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		expect(noteScopesRejected).toHaveBeenCalledTimes(1);
	});

	it("does not touch session health for an ordinary permission failure", async () => {
		await call(forbidden(), method, params);

		expect(noteScopesRejected).not.toHaveBeenCalled();
	});

	it("carries the retry-after the server asked for", async () => {
		const client = respondWith(429, envelope("RateLimited", "slow down"), {
			"retry-after": "12",
		});
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.retryAfterMs).toBe(12_000);
	});

	it("marks a response the AppView queued for us", async () => {
		const client = respondWith(200, JSON.stringify({ statuses: [] }), {
			"x-colibri-queued": "1",
		});
		const res = await call(client, method, params);

		expect(res.ok).toBe(true);
		if (res.ok) expect(res.queued).toBe(true);
	});

	it("does not turn a truncated body into an empty success", async () => {
		const client = respondWith(200, '{"statuses":');
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("MalformedResponse");
	});

	it("blames the network when the connection drops mid-body", async () => {
		const client = clientThat(
			async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new TypeError("Failed to fetch"));
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);
		const res = await call(client, colibri.channel.putReadCursors.main, {
			body: { community: "did:plc:community", cursors: [] },
		});

		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error.code).toBe("NetworkFailed");
			expect(res.error.domain).toBe("transport");
		}
	});

	it("fails a body that does not match the output schema", async () => {
		const client = respondWith(200, JSON.stringify({ statuses: "nope" }));
		const res = await call(client, method, params);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("MalformedResponse");
	});

	describe("when the server rejects a replayed DPoP proof", () => {
		const replayThenSucceeds = (replays: number) => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return calls <= replays
					? new Response(
							envelope("invalid_dpop_proof", "DPoP proof replayed"),
							{
								status: 401,
								headers: { "content-type": "application/json" },
							},
						)
					: new Response(JSON.stringify({ statuses: [] }), {
							status: 200,
							headers: { "content-type": "application/json" },
						});
			});
			return { client, attempts: () => calls };
		};

		it("tries again with a fresh proof and succeeds", async () => {
			const { client, attempts } = replayThenSucceeds(1);
			const res = await call(client, method, params);

			expect(res.ok).toBe(true);
			expect(attempts()).toBe(2);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("retries a write the server never got to run", async () => {
			const { client, attempts } = replayThenSucceeds(1);
			const res = await call(client, colibri.channel.putReadCursors.main, {
				body: { community: "did:plc:community", cursors: [] },
			});

			expect(res.ok).toBe(true);
			expect(attempts()).toBe(2);
		});

		it("gives up after a single extra attempt", async () => {
			const { client, attempts } = replayThenSucceeds(99);
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(attempts()).toBe(2);
			if (!res.ok) expect(res.error.code).toBe("AuthRequired");
		});

		it("leaves an ordinary rejection on the first attempt", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return new Response(envelope("invalid_token", "token is not valid"), {
					status: 401,
					headers: { "content-type": "application/json" },
				});
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
		});
	});

	describe("when the caller aborted the request", () => {
		const aborted = () => {
			const controller = new AbortController();
			controller.abort();
			return controller.signal;
		};

		it("fails without reporting", async () => {
			const client = clientThat(async () => {
				throw new DOMException("aborted", "AbortError");
			});
			const res = await call(client, method, params, { signal: aborted() });

			expect(res.ok).toBe(false);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("still reports the same rejection when no signal is involved", async () => {
			const client = clientThat(async () => {
				throw new TypeError("Failed to fetch");
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(reportError).toHaveBeenCalledTimes(1);
		});
	});

	describe("when the call runs out of time", () => {
		const hangs = () =>
			clientThat(
				(_path, init) =>
					new Promise<Response>((_resolve, reject) => {
						init.signal?.addEventListener("abort", () =>
							reject(new DOMException("timed out", "TimeoutError")),
						);
					}),
			);

		it("gives up with a timeout rather than hanging", async () => {
			const res = await call(hangs(), method, params, { timeoutMs: 10 });

			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.error.code).toBe("Timeout");
		});

		it("does not report a timeout", async () => {
			await call(hangs(), method, params, { timeoutMs: 10 });

			expect(reportError).not.toHaveBeenCalled();
		});

		it("lets the caller's own abort win over the deadline", async () => {
			const controller = new AbortController();
			const res = call(hangs(), method, params, {
				signal: controller.signal,
				timeoutMs: 60_000,
			});
			controller.abort();

			expect((await res).ok).toBe(false);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("leaves a call with time to spare alone", async () => {
			const res = await call(ok(), method, params, { timeoutMs: 60_000 });

			expect(res.ok).toBe(true);
		});
	});

	describe("once the session is dead", () => {
		beforeEach(() => {
			dead = true;
		});

		it("does not dispatch the request at all", async () => {
			const handler = vi.fn(async () => new Response("{}"));
			const res = await call(clientThat(handler), method, params);

			expect(res.ok).toBe(false);
			expect(handler).not.toHaveBeenCalled();
		});

		it("does not report anything", async () => {
			await call(ok(), method, params);

			expect(reportError).not.toHaveBeenCalled();
		});

		it("fails with the code that killed the session", async () => {
			deadCode = "ExpiredToken";
			const res = await call(ok(), method, params);

			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.error.code).toBe("ExpiredToken");
		});

		it("falls back to InvalidToken when no code was recorded", async () => {
			const res = await call(ok(), method, params);

			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.error.code).toBe("InvalidToken");
		});
	});

	describe("when a read fails on something that may pass", () => {
		const failsThenSucceeds = (failures: number, status: number) => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return calls <= failures
					? new Response(envelope("UpstreamFailure", "upstream is down"), {
							status,
							headers: { "content-type": "application/json" },
						})
					: new Response(JSON.stringify({ statuses: [] }), {
							status: 200,
							headers: { "content-type": "application/json" },
						});
			});
			return { client, attempts: () => calls };
		};

		it("tries again and succeeds", async () => {
			const { client, attempts } = failsThenSucceeds(1, 502);
			const res = await call(client, method, params);

			expect(res.ok).toBe(true);
			expect(attempts()).toBe(2);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("gives up after a bounded number of attempts", async () => {
			const { client, attempts } = failsThenSucceeds(99, 502);
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(attempts()).toBe(3);
			expect(reportError).toHaveBeenCalledTimes(1);
		});

		it("retries when the PDS cannot resolve the appview did", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return calls <= 1
					? new Response(
							envelope("InvalidRequest", "could not resolve proxy did"),
							{ status: 400, headers: { "content-type": "application/json" } },
						)
					: new Response(JSON.stringify({ statuses: [] }), {
							status: 200,
							headers: { "content-type": "application/json" },
						});
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(true);
			expect(calls).toBe(2);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("does not retry a failure the server will keep giving us", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return new Response(envelope("Forbidden", "not a member"), {
					status: 403,
					headers: { "content-type": "application/json" },
				});
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
		});

		it("leaves a rate limit for the caller rather than sleeping on it", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return new Response(envelope("RateLimited", "slow down"), {
					status: 429,
					headers: { "content-type": "application/json", "retry-after": "12" },
				});
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
			if (!res.ok) expect(res.error.retryAfterMs).toBe(12_000);
		});

		it("stops trying once the caller aborts", async () => {
			const controller = new AbortController();
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				controller.abort();
				throw new TypeError("Failed to fetch");
			});
			const res = await call(client, method, params, {
				signal: controller.signal,
			});

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("stops trying once the session dies", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				dead = true;
				throw new TypeError("Failed to fetch");
			});
			const res = await call(client, method, params);

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
		});

		it("does not retry a write, which the outbox owns", async () => {
			let calls = 0;
			const client = clientThat(async () => {
				calls += 1;
				return new Response(envelope("UpstreamFailure", "upstream is down"), {
					status: 502,
					headers: { "content-type": "application/json" },
				});
			});
			const res = await call(client, colibri.channel.putReadCursors.main, {
				body: { community: "did:plc:community", cursors: [] },
			});

			expect(res.ok).toBe(false);
			expect(calls).toBe(1);
		});
	});
});
