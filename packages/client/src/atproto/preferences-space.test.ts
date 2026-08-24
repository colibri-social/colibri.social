import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/logger", () => ({
	createLogger: () => ({
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
	}),
}));

const getDelegationToken = vi.fn();
const grantSpaceAccess = vi.fn();

const { regrantDelay, regrantRetryDelay, scheduleRegrant } = await import(
	"./preferences-space"
);

const APPVIEW_RENEW_WINDOW_MS = 300_000;

const agent = {
	did: "did:plc:viewer",
	com: { atproto: { space: { getDelegationToken } } },
} as never;

const xrpc = { call: grantSpaceAccess } as never;

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeEach(() => {
	vi.useFakeTimers();
	getDelegationToken.mockReset();
	grantSpaceAccess.mockReset();
	getDelegationToken.mockResolvedValue({ data: { token: "delegation" } });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("regrantDelay", () => {
	it("leaves the appview more margin than its own renewal window", () => {
		for (const lifetime of [400_000, 600_000, 900_000, 3_600_000]) {
			const delay = regrantDelay(lifetime);
			expect(lifetime - delay).toBeGreaterThan(APPVIEW_RENEW_WINDOW_MS);
		}
	});

	it("does not spin when the credential is already inside the window", () => {
		expect(regrantDelay(120_000)).toBeGreaterThanOrEqual(30_000);
		expect(regrantDelay(-1)).toBeGreaterThanOrEqual(30_000);
	});
});

describe("regrantRetryDelay", () => {
	it("backs off and stays bounded", () => {
		expect(regrantRetryDelay(1)).toBeLessThan(regrantRetryDelay(4));
		expect(regrantRetryDelay(99)).toBeLessThanOrEqual(120_000 * 1.2);
	});
});

describe("scheduleRegrant", () => {
	it("keeps trying after a grant that did not land", async () => {
		grantSpaceAccess.mockResolvedValueOnce({
			ok: false,
			error: { code: "UpstreamFailure" },
		});
		grantSpaceAccess.mockResolvedValueOnce({
			ok: true,
			data: { expiresAt: inMs(3_600_000) },
		});

		const stop = scheduleRegrant(agent, xrpc, inMs(390_000));

		await vi.advanceTimersByTimeAsync(31_000);
		expect(grantSpaceAccess).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(10_000);
		expect(grantSpaceAccess).toHaveBeenCalledTimes(2);

		stop();
	});

	it("stops the whole chain when the caller disposes it", async () => {
		grantSpaceAccess.mockResolvedValue({
			ok: true,
			data: { expiresAt: inMs(390_000) },
		});

		const stop = scheduleRegrant(agent, xrpc, inMs(390_000));

		await vi.advanceTimersByTimeAsync(31_000);
		expect(grantSpaceAccess).toHaveBeenCalledTimes(1);

		stop();

		await vi.advanceTimersByTimeAsync(600_000);
		expect(grantSpaceAccess).toHaveBeenCalledTimes(1);
	});
});
