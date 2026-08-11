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

const { request } = await import("./request");

const respondWith = (status: number, body: string) => async () =>
	new Response(body, { status, headers: { "content-type": "text/plain" } });

const forbidden = respondWith(
	403,
	JSON.stringify({
		error: "Forbidden",
		message: "caller is not a member of this community",
	}),
);

beforeEach(() => {
	reportError.mockClear();
	noteScopesRejected.mockClear();
	dead = false;
	deadCode = undefined;
});

describe("request", () => {
	it("does not report a failure the caller declared as expected", async () => {
		const res = await request(forbidden, {
			lxm: "social.colibri.channel.listUnreadStatus",
			route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
			expected: ["Forbidden"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("reports a failure the caller did not declare", async () => {
		const res = await request(forbidden, {
			lxm: "social.colibri.channel.listUnreadStatus",
			route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
			expected: ["InvalidRequest"],
		});

		expect(res.ok).toBe(false);
		expect(reportError).toHaveBeenCalledTimes(1);
	});

	it("classifies the envelope code even when the status disagrees", async () => {
		const res = await request(
			respondWith(
				502,
				JSON.stringify({ error: "Forbidden", message: "not a member" }),
			),
			{
				lxm: "social.colibri.channel.listUnreadStatus",
				route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
				expected: ["Forbidden"],
			},
		);

		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.error.code).toBe("Forbidden");
			expect(res.error.status).toBe(502);
		}
		expect(reportError).not.toHaveBeenCalled();
	});

	it("tells session health when the server says a scope is missing", async () => {
		const res = await request(
			respondWith(
				403,
				JSON.stringify({
					error: "ScopeMissingError",
					message:
						'Missing required scope "rpc:social.colibri.actor.listCommunities?aud=did:web:api.colibri.social"',
				}),
			),
			{
				lxm: "social.colibri.actor.listCommunities",
				route: "/xrpc/social.colibri.actor.listCommunities",
			},
		);

		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error.code).toBe("ScopesMissing");
		expect(noteScopesRejected).toHaveBeenCalledWith({
			method: "social.colibri.actor.listCommunities",
		});
	});

	it("does not touch session health for an ordinary permission failure", async () => {
		await request(forbidden, {
			lxm: "social.colibri.community.listApplications",
			route: "/xrpc/social.colibri.community.listApplications?community=at://c",
		});

		expect(noteScopesRejected).not.toHaveBeenCalled();
	});

	describe("once the session is dead", () => {
		const send = vi.fn(forbidden);

		beforeEach(() => {
			send.mockClear();
			dead = true;
		});

		it("does not dispatch the request at all", async () => {
			await request(send, {
				lxm: "social.colibri.notification.registerPush",
				route: "/xrpc/social.colibri.notification.registerPush",
			});

			expect(send).not.toHaveBeenCalled();
		});

		it("does not report anything", async () => {
			await request(send, {
				lxm: "social.colibri.channel.listUnreadStatus",
				route: "/xrpc/social.colibri.channel.listUnreadStatus?community=at://c",
			});

			expect(reportError).not.toHaveBeenCalled();
		});

		it("fails with the code that killed the session", async () => {
			deadCode = "ExpiredToken";
			const res = await request(send, {
				lxm: "social.colibri.channel.getChannelView",
				route: "/xrpc/social.colibri.channel.getChannelView?channel=at://c",
			});

			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.error.code).toBe("ExpiredToken");
		});

		it("falls back to InvalidToken when no code was recorded", async () => {
			const res = await request(send, {
				lxm: "social.colibri.channel.getChannelView",
				route: "/xrpc/social.colibri.channel.getChannelView?channel=at://c",
			});

			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.error.code).toBe("InvalidToken");
		});
	});
});
