import { ColibriError } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import {
	createSessionHealth,
	FAILURE_WINDOW_MS,
	RESUME_GRACE_MS,
	type SessionHealthOptions,
} from "./session-health";

vi.mock("../sentry/report", () => ({ reportError: () => undefined }));

const deferred = () => {
	let resolve: () => void = () => {};
	let reject: (err: unknown) => void = () => {};
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const setup = (options: SessionHealthOptions = {}) => {
	let now = 1_000_000;
	const refresh = vi.fn(() => Promise.resolve());
	const health = createSessionHealth(() => now, { refresh, ...options });
	return {
		health,
		refresh,
		advance: (ms: number) => {
			now += ms;
		},
	};
};

const unauthorized = () => new Response("", { status: 401 });

describe("session health", () => {
	it("refreshes before counting a rejection and ignores the burst that came before", async () => {
		const { health, refresh } = setup();
		for (let index = 0; index < 5; index++)
			health.noteAuthFailure("AuthRequired");
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(health.dead()).toBe(false);
		await settle();
		expect(health.dead()).toBe(false);
	});

	it("signs out when rejections continue after a successful refresh", async () => {
		const { health } = setup();
		health.noteAuthFailure("AuthRequired");
		await settle();
		health.noteAuthFailure("AuthRequired");
		health.noteAuthFailure("AuthRequired");
		expect(health.dead()).toBe(false);
		health.noteAuthFailure("AuthRequired");
		expect(health.dead()).toBe(true);
		expect(health.deadCode()).toBe("AuthRequired");
	});

	it("ignores rejections of requests sent before the refresh finished", async () => {
		const { health } = setup();
		const pending = [deferred(), deferred(), deferred(), deferred()];
		const requests = pending.map(({ promise }) =>
			health
				.observe(
					"https://pds.example/xrpc/app.example.get",
					promise.then(unauthorized),
				)
				.catch(() => undefined),
		);
		pending[0]?.resolve();
		await settle();
		for (const request of pending.slice(1)) request.resolve();
		await Promise.all(requests);
		expect(health.dead()).toBe(false);
	});

	it("never counts while the refresh keeps failing", async () => {
		const refresh = vi.fn(() =>
			Promise.reject(new ColibriError({ code: "Unreachable" })),
		);
		const { health } = setup({ refresh });
		for (let round = 0; round < 4; round++) {
			health.noteAuthFailure("AuthRequired");
			await settle();
		}
		expect(refresh).toHaveBeenCalledTimes(4);
		expect(health.dead()).toBe(false);
	});

	it("ignores rejections while offline", async () => {
		const { health, refresh } = setup({ online: () => false });
		health.noteAuthFailure("AuthRequired");
		await settle();
		for (let index = 0; index < 3; index++)
			health.noteAuthFailure("AuthRequired");
		expect(refresh).not.toHaveBeenCalled();
		expect(health.dead()).toBe(false);
	});

	it("holds off counting right after a wake", async () => {
		const { health, advance } = setup();
		health.noteAuthFailure("AuthRequired");
		await settle();
		health.noteResume();
		for (let index = 0; index < 3; index++)
			health.noteAuthFailure("AuthRequired");
		await settle();
		expect(health.dead()).toBe(false);
		advance(RESUME_GRACE_MS);
		health.noteAuthFailure("AuthRequired");
		await settle();
		for (let index = 0; index < 3; index++)
			health.noteAuthFailure("AuthRequired");
		expect(health.dead()).toBe(true);
	});

	it("refreshes again once the last refresh is older than the window", async () => {
		const { health, refresh, advance } = setup();
		health.noteAuthFailure("AuthRequired");
		await settle();
		advance(FAILURE_WINDOW_MS + 1);
		for (let index = 0; index < 3; index++)
			health.noteAuthFailure("AuthRequired");
		expect(refresh).toHaveBeenCalledTimes(2);
		expect(health.dead()).toBe(false);
	});

	it("still signs out at once on a revoked session", () => {
		const { health, refresh } = setup();
		health.noteAuthFailure("InvalidToken");
		expect(health.dead()).toBe(true);
		expect(refresh).not.toHaveBeenCalled();
	});

	it("counts without a refresh hook as before", () => {
		const health = createSessionHealth(() => 0, { online: () => true });
		health.noteAuthFailure("AuthRequired");
		health.noteAuthFailure("AuthRequired");
		expect(health.dead()).toBe(false);
		health.noteAuthFailure("AuthRequired");
		expect(health.dead()).toBe(true);
	});
});
