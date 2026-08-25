import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../errors/report"), async (importOriginal) => ({
	...(await importOriginal()),
	reportError: vi.fn(),
}));

const load = async () => {
	vi.resetModules();
	return import("./session-health");
};

afterEach(() => {
	vi.useRealTimers();
});

describe("noteAuthFailure", () => {
	it("keeps the session alive after a single rejection", async () => {
		const { noteAuthFailure, sessionDead } = await load();
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(false);
	});

	it("gives up after three rejections in a row", async () => {
		const { noteAuthFailure, sessionDead, sessionDeadCode } = await load();
		noteAuthFailure("AuthRequired");
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(false);
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(true);
		expect(sessionDeadCode()).toBe("AuthRequired");
	});

	it("forgets earlier rejections once a request succeeds", async () => {
		const { noteAuthFailure, noteAuthSuccess, sessionDead } = await load();
		noteAuthFailure("AuthRequired");
		noteAuthFailure("AuthRequired");
		noteAuthSuccess();
		noteAuthFailure("AuthRequired");
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(false);
	});

	it("forgets rejections that are more than a minute apart", async () => {
		vi.useFakeTimers();
		const { noteAuthFailure, sessionDead } = await load();
		noteAuthFailure("AuthRequired");
		noteAuthFailure("AuthRequired");
		vi.advanceTimersByTime(61_000);
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(false);
	});

	it("gives up immediately on an expired token", async () => {
		const { noteAuthFailure, sessionDead, sessionDeadCode } = await load();
		noteAuthFailure("ExpiredToken");
		expect(sessionDead()).toBe(true);
		expect(sessionDeadCode()).toBe("ExpiredToken");
	});

	it("leaves missing permissions to the scope gate", async () => {
		const { noteAuthFailure, sessionDead } = await load();
		noteAuthFailure("ScopesMissing");
		noteAuthFailure("ScopesMissing");
		noteAuthFailure("ScopesMissing");
		expect(sessionDead()).toBe(false);
	});

	it("ignores failures that say nothing about the session", async () => {
		const { noteAuthFailure, sessionDead } = await load();
		noteAuthFailure("Offline");
		noteAuthFailure("Offline");
		noteAuthFailure("Offline");
		expect(sessionDead()).toBe(false);
	});

	it("stays quiet while the user is signing out", async () => {
		const { beginSignOut, noteAuthFailure, sessionDead } = await load();
		beginSignOut();
		noteAuthFailure("ExpiredToken");
		expect(sessionDead()).toBe(false);
	});
});

describe("beginSignOut", () => {
	it("clears a session that already gave up", async () => {
		const { beginSignOut, noteAuthFailure, sessionDead, sessionDeadCode } =
			await load();
		noteAuthFailure("ExpiredToken");
		expect(sessionDead()).toBe(true);
		beginSignOut();
		expect(sessionDead()).toBe(false);
		expect(sessionDeadCode()).toBeUndefined();
	});
});

describe("noteSessionDeleted", () => {
	it("gives up as soon as the OAuth client drops the session", async () => {
		const { noteSessionDeleted, sessionDead, sessionDeadCode } = await load();
		const cause = new Error("token refresh failed");
		cause.name = "TokenRefreshError";
		noteSessionDeleted(cause);
		expect(sessionDead()).toBe(true);
		expect(sessionDeadCode()).toBe("ExpiredToken");
	});

	it("still gives up when the cause says nothing useful", async () => {
		const { noteSessionDeleted, sessionDeadCode } = await load();
		noteSessionDeleted(new Error("gone"));
		expect(sessionDeadCode()).toBe("InvalidToken");
	});
});

describe("observeSession", () => {
	it("passes a successful response through and clears the counter", async () => {
		const { noteAuthFailure, observeSession, sessionDead } = await load();
		noteAuthFailure("AuthRequired");
		noteAuthFailure("AuthRequired");
		const res = await observeSession(
			"/xrpc/social.colibri.beta.actor.getProfile",
			Promise.resolve(new Response("{}", { status: 200 })),
		);
		expect(res.status).toBe(200);
		noteAuthFailure("AuthRequired");
		expect(sessionDead()).toBe(false);
	});

	it("counts a 401 without swallowing the response", async () => {
		const { observeSession, sessionDead } = await load();
		const unauthorized = () =>
			observeSession(
				"/xrpc/social.colibri.beta.actor.getProfile",
				Promise.resolve(new Response("", { status: 401 })),
			);
		expect((await unauthorized()).status).toBe(401);
		await unauthorized();
		expect(sessionDead()).toBe(false);
		await unauthorized();
		expect(sessionDead()).toBe(true);
	});

	it("rethrows a token failure after giving up on the session", async () => {
		const { observeSession, sessionDead } = await load();
		const cause = new Error("session revoked");
		cause.name = "TokenRevokedError";
		await expect(
			observeSession(
				"/xrpc/social.colibri.beta.actor.getProfile",
				Promise.reject(cause),
			),
		).rejects.toBe(cause);
		expect(sessionDead()).toBe(true);
	});

	it("does not blame the session for a replayed DPoP proof", async () => {
		const { observeSession, sessionDead } = await load();
		const replayed = () =>
			observeSession(
				"/xrpc/social.colibri.beta.actor.getProfile",
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: "invalid_dpop_proof",
							message: "DPoP proof replayed",
						}),
						{ status: 401, headers: { "content-type": "application/json" } },
					),
				),
			);
		for (let i = 0; i < 5; i += 1) expect((await replayed()).status).toBe(401);
		expect(sessionDead()).toBe(false);
	});

	it("reads the proof failure off the challenge header too", async () => {
		const { observeSession, sessionDead } = await load();
		const challenged = () =>
			observeSession(
				"/xrpc/social.colibri.beta.actor.getProfile",
				Promise.resolve(
					new Response("", {
						status: 401,
						headers: {
							"www-authenticate":
								'DPoP error="use_dpop_nonce", error_description="nonce required"',
						},
					}),
				),
			);
		for (let i = 0; i < 5; i += 1) await challenged();
		expect(sessionDead()).toBe(false);
	});

	it("leaves the body readable for the caller", async () => {
		const { observeSession } = await load();
		const res = await observeSession(
			"/xrpc/social.colibri.beta.actor.getProfile",
			Promise.resolve(
				new Response(JSON.stringify({ error: "invalid_dpop_proof" }), {
					status: 401,
					headers: { "content-type": "application/json" },
				}),
			),
		);
		expect(await res.json()).toEqual({ error: "invalid_dpop_proof" });
	});

	it("still ends the session when the token itself is rejected", async () => {
		const { observeSession, sessionDead } = await load();
		const rejected = () =>
			observeSession(
				"/xrpc/social.colibri.beta.actor.getProfile",
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: "invalid_token",
							message: "token is not valid",
						}),
						{ status: 401, headers: { "content-type": "application/json" } },
					),
				),
			);
		await rejected();
		await rejected();
		expect(sessionDead()).toBe(false);
		await rejected();
		expect(sessionDead()).toBe(true);
	});

	it("does not blame the session for a refused service-auth mint", async () => {
		const { observeSession, sessionDead } = await load();
		const refused = () =>
			observeSession(
				"/xrpc/com.atproto.server.getServiceAuth",
				Promise.resolve(new Response("", { status: 401 })),
			);
		for (let i = 0; i < 5; i += 1) expect((await refused()).status).toBe(401);
		expect(sessionDead()).toBe(false);
	});
});
