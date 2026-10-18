import { colibri } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSession, json, xrpcError } from "../remote/fake-session";
import { createTransport } from "../remote/transport";
import {
	createPreferencesGrant,
	regrantDelay,
	regrantRetryDelay,
} from "./grant";
import { createPreferencesSpace } from "./remote";

const VIEWER = "did:plc:viewer";
const APPVIEW_RENEW_WINDOW_MS = 120_000;
const GRANT = colibri.actor.grantSpaceAccess.main.nsid;
const DELEGATE = "com.atproto.space.getDelegationToken";

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

const setup = () => {
	const fake = createFakeSession(VIEWER);
	const transport = createTransport({
		session: fake.session,
		appViewDid: "did:web:appview.test",
	});
	const space = createPreferencesSpace(transport);
	return { fake, grant: createPreferencesGrant({ transport, space }) };
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("regrantDelay", () => {
	it("leaves the AppView more margin than its own renewal window", () => {
		for (const lifetime of [200_000, 600_000, 900_000, 3_600_000]) {
			expect(lifetime - regrantDelay(lifetime)).toBeGreaterThan(
				APPVIEW_RENEW_WINDOW_MS,
			);
		}
	});

	it("does not spin when the credential is already inside the window", () => {
		expect(regrantDelay(60_000)).toBeGreaterThanOrEqual(30_000);
		expect(regrantDelay(-1)).toBeGreaterThanOrEqual(30_000);
	});
});

describe("regrantRetryDelay", () => {
	it("backs off and stays bounded", () => {
		expect(regrantRetryDelay(1)).toBeLessThan(regrantRetryDelay(4));
		expect(regrantRetryDelay(99)).toBeLessThanOrEqual(120_000 * 1.2);
	});
});

describe("createPreferencesGrant", () => {
	it("hands the AppView a delegation token for the preferences space", async () => {
		const { fake, grant } = setup();
		fake.on(DELEGATE, json({ token: "delegation" }));
		fake.on(GRANT, json({ expiresAt: inMs(600_000) }));

		await expect(grant.grant()).resolves.toBeDefined();

		const [call] = fake.callsTo(GRANT);
		expect(call?.body).toEqual({
			space: `at://${VIEWER}/space/social.colibri.beta.actor.preferences/self`,
			delegationToken: "delegation",
		});
		expect(call?.headers.get("atproto-proxy")).toContain(
			"did:web:appview.test",
		);
	});

	it("creates a missing space before granting", async () => {
		const { fake, grant } = setup();
		fake.on(
			DELEGATE,
			xrpcError(400, "SpaceNotFound"),
			json({ token: "delegation" }),
		);
		fake.on("com.atproto.simplespace.createSpace", json({}));
		fake.on(GRANT, json({ expiresAt: inMs(600_000) }));

		await expect(grant.grant()).resolves.toBeDefined();
		expect(fake.callsTo("com.atproto.simplespace.createSpace")).toHaveLength(1);
		expect(fake.callsTo(DELEGATE)).toHaveLength(2);
	});

	it("regrants before expiry and retries a grant that did not land", async () => {
		const { fake, grant } = setup();
		fake.on(DELEGATE, json({ token: "delegation" }));
		fake.on(
			GRANT,
			json({ expiresAt: inMs(200_000) }),
			xrpcError(502, "UpstreamFailure"),
			json({ expiresAt: inMs(3_600_000) }),
		);

		const stop = grant.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.callsTo(GRANT)).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(31_000);
		expect(fake.callsTo(GRANT)).toHaveLength(2);

		await vi.advanceTimersByTimeAsync(10_000);
		expect(fake.callsTo(GRANT)).toHaveLength(3);

		stop();
	});

	it("stops the chain when disposed", async () => {
		const { fake, grant } = setup();
		fake.on(DELEGATE, json({ token: "delegation" }));
		fake.on(GRANT, json({ expiresAt: inMs(200_000) }));

		const stop = grant.start();
		await vi.advanceTimersByTimeAsync(0);
		stop();

		await vi.advanceTimersByTimeAsync(600_000);
		expect(fake.callsTo(GRANT)).toHaveLength(1);
	});
});
