import type { OAuthSession } from "@atproto/oauth-client-browser";
import { ColibriError } from "@colibri-social/lib";
import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResumeEnvironment } from "../data/resume";
import {
	type AuthOptions,
	createAuth,
	GRANT_REFRESH_AFTER_MS,
	type LoadOAuthClient,
} from "./auth";
import {
	expandedScope,
	type FakeClientState,
	FULL_SCOPE,
	fakeClient,
	fakeLocation,
	fakeSession,
	memoryStorage,
} from "./testing";

const DID = "did:plc:alice";

let disposers: Array<() => void> = [];

afterEach(() => {
	for (const dispose of disposers) dispose();
	disposers = [];
	vi.unstubAllGlobals();
});

const setup = (
	state: Partial<FakeClientState>,
	options: Partial<AuthOptions> = {},
) => {
	const fake: FakeClientState = { calls: [], ...state };
	const { load } = fakeClient(fake);
	const navigate = vi.fn<(path: string) => void>();
	const storage = options.storage ?? memoryStorage();
	const session = options.session ?? memoryStorage();
	const auth = createRoot((dispose) => {
		disposers.push(dispose);
		return createAuth({
			native: false,
			loadClient: load,
			storage,
			session,
			location: fakeLocation("/app"),
			navigate,
			...options,
		});
	});
	return { auth, fake, navigate, storage, session };
};

const stubResolve = (did: string | undefined) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			if (input.includes("com.atproto.identity.resolveHandle")) {
				return did
					? new Response(JSON.stringify({ did }), { status: 200 })
					: new Response(
							JSON.stringify({
								error: "InvalidRequest",
								message: "Unable to resolve",
							}),
							{ status: 400 },
						);
			}
			return new Response("", { status: 404 });
		}),
	);
};

describe("createAuth", () => {
	it("stays signed out without a saved account", async () => {
		const { auth } = setup({});
		expect(auth.status()).toBe("loading");
		await auth.init();
		expect(auth.status()).toBe("signedOut");
		expect(auth.agent()).toBeUndefined();
	});

	it("restores the saved account", async () => {
		const { auth, fake } = setup(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await auth.init();
		expect(auth.status()).toBe("signedIn");
		expect(auth.did()).toBe(DID);
		expect(fake.calls.map((call) => call.method)).toContain("restore");
	});

	it("asks to sign in again when the saved account was revoked", async () => {
		const storage = memoryStorage({ sub: DID });
		const { auth } = setup(
			{
				restoreError: new ColibriError({ code: "InvalidToken" }),
			},
			{ storage },
		);
		await auth.init();
		expect(auth.status()).toBe("signedOut");
		expect(auth.error()?.code).toBe("InvalidToken");
		expect(storage.getItem("sub")).toBeNull();
	});

	it("finishes a web sign-in and returns to the saved path", async () => {
		const session = memoryStorage({ "colibri:return-to": "/app/inbox" });
		const { auth, navigate } = setup(
			{ callbackSession: fakeSession(DID) },
			{
				session,
				location: fakeLocation("/app/login", { hash: "#state=s&code=c&iss=x" }),
			},
		);
		await auth.init();
		expect(auth.status()).toBe("signedIn");
		expect(navigate).toHaveBeenLastCalledWith("/app/inbox");
		expect(session.getItem("colibri:return-to")).toBeNull();
	});

	it("treats a declined sign-in as no error", async () => {
		const { auth } = setup(
			{},
			{
				location: fakeLocation("/app/login", {
					search: "?state=s&error=access_denied",
				}),
			},
		);
		await auth.init();
		expect(auth.status()).toBe("signedOut");
		expect(auth.error()).toBeUndefined();
	});

	it("reports a username that doesn't exist", async () => {
		stubResolve(undefined);
		const { auth, fake } = setup({});
		await auth.init();
		await auth.signIn("nobody.example");
		expect(auth.error()?.code).toBe("HandleNotFound");
		expect(auth.phase()).toBeUndefined();
		expect(fake.calls.some((call) => call.method === "signIn")).toBe(false);
	});

	it("hands off to the account provider with the resolved account", async () => {
		stubResolve(DID);
		const { auth, fake, session } = setup(
			{},
			{ location: fakeLocation("/app/c/did:plc:space") },
		);
		await auth.init();
		void auth.signIn("@Alice.example");
		await vi.waitFor(() => expect(auth.phase()).toBe("redirecting"));
		const call = fake.calls.find((entry) => entry.method === "signIn");
		expect(call?.input).toBe(DID);
		expect(String((call?.options as { scope: string }).scope)).toContain(
			"include:social.colibri.beta.permissionAccount",
		);
		expect(session.getItem("colibri:return-to")).toBe("/app/c/did:plc:space");
	});

	it("stops before the handoff when the provider has no Spaces support", async () => {
		stubResolve(DID);
		const spacesSupport = vi.fn(async () => false);
		const { auth, fake } = setup(
			{},
			{ pdsHost: async () => "pds.example", spacesSupport },
		);
		await auth.init();
		await auth.signIn("alice.example");
		expect(spacesSupport).toHaveBeenCalledWith("pds.example");
		expect(auth.error()?.code).toBe("SpacesUnsupported");
		expect(auth.phase()).toBeUndefined();
		expect(fake.calls.some((call) => call.method === "signIn")).toBe(false);
	});

	it.each([
		["supported", true],
		["unknown", undefined],
	] as const)("continues to the provider when support is %s", async (_, answer) => {
		stubResolve(DID);
		const { auth, fake } = setup(
			{},
			{ pdsHost: async () => "pds.example", spacesSupport: async () => answer },
		);
		await auth.init();
		void auth.signIn("alice.example");
		await vi.waitFor(() => expect(auth.phase()).toBe("redirecting"));
		expect(auth.error()).toBeUndefined();
		expect(fake.calls.find((call) => call.method === "signIn")?.input).toBe(
			DID,
		);
	});

	it("checks the sign-up provider before creating an account", async () => {
		const spacesSupport = vi.fn(async () => false);
		const { auth, fake } = setup({}, { spacesSupport });
		await auth.init();
		await auth.signIn("https://signup.example", { create: true });
		expect(spacesSupport).toHaveBeenCalledWith("signup.example");
		expect(auth.error()?.code).toBe("SpacesUnsupported");
		expect(fake.calls.some((call) => call.method === "signIn")).toBe(false);
	});

	it("opens the native sign-in sheet and finishes inline", async () => {
		stubResolve(DID);
		const webAuth = vi.fn(
			async () => "social.colibri:/oauth/callback?state=s&code=c&iss=x",
		);
		const { auth, fake, navigate } = setup(
			{ callbackSession: fakeSession(DID) },
			{ native: true, webAuth },
		);
		await auth.init();
		await auth.signIn("alice.example");
		expect(webAuth).toHaveBeenCalledWith(
			"https://pds.example/authorize",
			"social.colibri",
		);
		expect(fake.calls.some((call) => call.method === "callback")).toBe(true);
		expect(auth.status()).toBe("signedIn");
		expect(navigate).toHaveBeenLastCalledWith("/app");
	});

	it("stays quiet when the native sheet is cancelled", async () => {
		stubResolve(DID);
		const webAuth = vi.fn(async () => {
			throw { code: "Cancelled", message: "cancelled" };
		});
		const { auth } = setup({}, { native: true, webAuth });
		await auth.init();
		await auth.signIn("alice.example");
		expect(auth.error()).toBeUndefined();
		expect(auth.phase()).toBeUndefined();
		expect(auth.status()).toBe("signedOut");
	});

	it("falls back to the browser where the native sheet isn't available", async () => {
		stubResolve(DID);
		const openBrowser = vi.fn();
		const webAuth = vi.fn(async () => {
			throw { code: "Unsupported", message: "unsupported" };
		});
		const { auth } = setup({}, { native: true, webAuth, openBrowser });
		await auth.init();
		await auth.signIn("alice.example");
		expect(openBrowser).toHaveBeenCalledWith("https://pds.example/authorize");
		expect(auth.phase()).toBe("browser");
		expect(auth.error()).toBeUndefined();
	});

	it("expires after a rejected token and recovers on sign-in", async () => {
		const { auth } = setup(
			{ stored: fakeSession(DID), callbackSession: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await auth.init();
		auth.onAuthFailure("ExpiredToken");
		expect(auth.status()).toBe("expired");
		expect(auth.expiredCode()).toBe("ExpiredToken");
		await auth.completeCallback(new URLSearchParams("state=s&code=c&iss=x"));
		expect(auth.status()).toBe("signedIn");
	});

	it("needs three soft failures inside a minute to expire", async () => {
		const { auth } = setup(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await auth.init();
		auth.onAuthFailure("AuthRequired");
		auth.onAuthFailure("AuthRequired");
		expect(auth.status()).toBe("signedIn");
		auth.onAuthFailure("AuthRequired");
		expect(auth.status()).toBe("expired");
	});

	it("lists missing access and asks again with the same account", async () => {
		stubResolve(DID);
		const { auth, fake } = setup(
			{ stored: fakeSession(DID, "atproto") },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await auth.init();
		expect(auth.missingScopes().length).toBeGreaterThan(0);
		void auth.reauthorize();
		await vi.waitFor(() =>
			expect(fake.calls.some((call) => call.method === "signIn")).toBe(true),
		);
		expect(fake.calls.find((call) => call.method === "signIn")?.input).toBe(
			DID,
		);
	});

	it("signs out, revokes and goes back to sign-in", async () => {
		const storage = memoryStorage({ sub: DID });
		const onSignedOut = vi.fn();
		const { auth, fake, navigate } = setup(
			{ stored: fakeSession(DID) },
			{ storage, onSignedOut },
		);
		await auth.init();
		await auth.signOut();
		expect(fake.calls.at(-1)).toEqual({ method: "revoke", input: DID });
		expect(auth.status()).toBe("signedOut");
		expect(storage.getItem("sub")).toBeNull();
		expect(navigate).toHaveBeenLastCalledWith("/app/login");
		expect(onSignedOut).toHaveBeenCalled();
	});

	it("runs the sign-out cleanup before revoking", async () => {
		const { auth, fake } = setup(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await auth.init();
		let revokedBeforeCleanup: boolean | undefined;
		await auth.signOut({
			beforeSignOut: async () => {
				revokedBeforeCleanup = fake.calls.some(
					(call) => call.method === "revoke",
				);
			},
		});
		expect(revokedBeforeCleanup).toBe(false);
		expect(fake.calls.at(-1)).toEqual({ method: "revoke", input: DID });
	});

	it("stops waiting for a stuck sign-out cleanup", async () => {
		const { auth, fake } = setup(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }), beforeSignOutTimeoutMs: 30 },
		);
		await auth.init();
		await auth.signOut({ beforeSignOut: () => new Promise(() => {}) });
		expect(fake.calls.at(-1)).toEqual({ method: "revoke", input: DID });
		expect(auth.status()).toBe("signedOut");
	});
});

const hangingOnce = (state: FakeClientState, settle?: () => Promise<never>) => {
	const { client } = fakeClient(state);
	let attempts = 0;
	const loadClient: LoadOAuthClient = async () => {
		attempts += 1;
		if (attempts > 1) return client;
		return {
			...client,
			init: () => settle?.() ?? new Promise<never>(() => {}),
		};
	};
	return loadClient;
};

describe("startup", () => {
	it("lands on a failure that can be retried when restoring hangs", async () => {
		const fake: FakeClientState = { calls: [], stored: fakeSession(DID) };
		const { auth } = setup(
			{},
			{
				loadClient: hangingOnce(fake),
				startupTimeoutMs: 50,
				storage: memoryStorage({ sub: DID }),
			},
		);
		await auth.init();
		expect(auth.status()).toBe("failed");
		expect(auth.startupError()?.code).toBe("Timeout");
		await auth.retryInit();
		expect(auth.status()).toBe("signedIn");
		expect(auth.startupError()).toBeUndefined();
		expect(auth.did()).toBe(DID);
	});

	it("ignores a restore that finishes after the deadline", async () => {
		const fake: FakeClientState = { calls: [], stored: fakeSession(DID) };
		const late = () =>
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("too late")), 120),
			);
		const { auth } = setup(
			{},
			{
				loadClient: hangingOnce(fake, late),
				startupTimeoutMs: 40,
				storage: memoryStorage({ sub: DID }),
			},
		);
		await auth.init();
		expect(auth.status()).toBe("failed");
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(auth.status()).toBe("failed");
		expect(fake.calls.some((call) => call.method === "restore")).toBe(false);
	});

	it("turns an unexpected startup error into a failure", async () => {
		const { auth } = setup(
			{},
			{
				navigate: () => {
					throw new Error("navigation blocked");
				},
				location: fakeLocation("/app/login", {
					hash: "#state=s&code=c&iss=x",
				}),
			},
		);
		await auth.init();
		expect(auth.status()).toBe("failed");
		expect(auth.startupError()?.code).toBe("Unexpected");
	});
});

const COMMUNITY = "social.colibri.beta.permissionCommunity";
const GET_CATALOG = "social.colibri.beta.emoji.getCatalog";
const LIST_BANS = "social.colibri.beta.community.listBans";
const CALLBACK = new URLSearchParams("state=s&code=c&iss=x");

const scopeSetup = (
	scope: string,
	options: Partial<AuthOptions> & { callbackScope?: string } = {},
) => {
	const { callbackScope, ...rest } = options;
	return setup(
		{
			stored: fakeSession(DID, scope),
			callbackSession: fakeSession(DID, callbackScope ?? scope),
		},
		{
			storage: memoryStorage({ sub: DID }),
			pdsHost: async () => undefined,
			resumeEnvironment: null,
			appVersion: "1.0.0",
			...rest,
		},
	);
};

const reapprove = async (
	auth: ReturnType<typeof setup>["auth"],
	fake: FakeClientState,
) => {
	stubResolve(DID);
	void auth.reauthorize();
	await vi.waitFor(() =>
		expect(fake.calls.some((call) => call.method === "signIn")).toBe(true),
	);
	await auth.completeCallback(CALLBACK);
};

describe("scope notice", () => {
	it("shows a notice and no gate for a method missing from an approved set", async () => {
		const { auth } = scopeSetup(expandedScope({ omitMethods: [GET_CATALOG] }));
		await auth.init();
		expect(auth.missingScopes()).toEqual([]);
		expect(auth.scopeNotice()).toEqual({
			methods: [GET_CATALOG],
			features: ["Custom emoji"],
		});
	});

	it("keeps the gate and no notice when a whole set is missing", async () => {
		const { auth } = scopeSetup(expandedScope({ omitSets: [COMMUNITY] }));
		await auth.init();
		expect(auth.missingScopes()).toEqual([COMMUNITY]);
		expect(auth.scopeNotice()).toBeUndefined();
	});

	it("turns a rejected call into a notice without the gate", async () => {
		const { auth } = scopeSetup(FULL_SCOPE);
		await auth.init();
		expect(auth.scopeNotice()).toBeUndefined();
		auth.health.noteScopesRejected(LIST_BANS);
		expect(auth.missingScopes()).toEqual([]);
		expect(auth.scopeNotice()).toEqual({
			methods: [LIST_BANS],
			features: ["Communities & channels"],
		});
	});

	it("shows a generic notice for a rejection outside Colibri's own access", async () => {
		const { auth } = scopeSetup(FULL_SCOPE);
		await auth.init();
		auth.health.noteScopesRejected("com.atproto.space.putRecord");
		expect(auth.scopeNotice()).toEqual({ methods: [""], features: [] });
		auth.health.noteScopesRejected();
		expect(auth.scopeNotice()?.methods).toEqual([""]);
	});

	it("ignores a rejection without a method once one with a method is known", async () => {
		const { auth } = scopeSetup(FULL_SCOPE);
		await auth.init();
		auth.health.noteScopesRejected(LIST_BANS);
		auth.health.noteScopesRejected();
		expect(auth.scopeNotice()?.methods).toEqual([LIST_BANS]);
	});

	it("stays dismissed for the session until something new is missing", async () => {
		const { auth } = scopeSetup(expandedScope({ omitMethods: [GET_CATALOG] }));
		await auth.init();
		auth.dismissScopeNotice();
		expect(auth.scopeNotice()).toBeUndefined();
		auth.health.noteScopesRejected(LIST_BANS);
		expect(auth.scopeNotice()?.methods).toEqual([LIST_BANS]);
	});

	it("asks again with the same account from the notice", async () => {
		const { auth, fake } = scopeSetup(
			expandedScope({ omitMethods: [GET_CATALOG] }),
			{ callbackScope: expandedScope() },
		);
		await auth.init();
		await reapprove(auth, fake);
		expect(fake.calls.find((call) => call.method === "signIn")?.input).toBe(
			DID,
		);
		expect(auth.scopeNotice()).toBeUndefined();
	});
});

describe("scope prompt loop guard", () => {
	it("pauses a method still missing right after approval until the app updates", async () => {
		const storage = memoryStorage({ sub: DID });
		const stale = expandedScope({ omitMethods: [GET_CATALOG] });
		const { auth, fake } = scopeSetup(stale, { storage });
		await auth.init();
		await reapprove(auth, fake);
		expect(auth.status()).toBe("signedIn");
		expect(auth.scopeNotice()).toBeUndefined();
		expect(
			JSON.parse(storage.getItem("colibri:scope-prompt-paused") ?? ""),
		).toEqual({
			version: "1.0.0",
			methods: [GET_CATALOG],
		});

		const sameVersion = scopeSetup(stale, { storage });
		await sameVersion.auth.init();
		expect(sameVersion.auth.scopeNotice()).toBeUndefined();

		const nextVersion = scopeSetup(stale, { storage, appVersion: "1.1.0" });
		await nextVersion.auth.init();
		expect(nextVersion.auth.scopeNotice()?.methods).toEqual([GET_CATALOG]);
		expect(storage.getItem("colibri:scope-prompt-paused")).toBeNull();
	});

	it("pauses a method rejected again right after approval", async () => {
		const storage = memoryStorage({ sub: DID });
		const { auth, fake } = scopeSetup(FULL_SCOPE, { storage });
		await auth.init();
		auth.health.noteScopesRejected(LIST_BANS);
		await reapprove(auth, fake);
		expect(auth.scopeNotice()).toBeUndefined();
		auth.health.noteScopesRejected(LIST_BANS);
		expect(auth.scopeNotice()).toBeUndefined();
		expect(storage.getItem("colibri:scope-prompt-paused")).toContain(LIST_BANS);
	});

	it("keeps prompting for methods that were not part of the approval", async () => {
		const { auth, fake } = scopeSetup(FULL_SCOPE);
		await auth.init();
		await reapprove(auth, fake);
		auth.health.noteScopesRejected(LIST_BANS);
		expect(auth.scopeNotice()?.methods).toEqual([LIST_BANS]);
	});
});

const fakeResume = () => {
	const document = new EventTarget();
	const window = new EventTarget();
	let visible = true;
	let now = 0;
	const environment: ResumeEnvironment = {
		document,
		window,
		visible: () => visible,
		now: () => now,
	};
	const awayFor = (ms: number) => {
		visible = false;
		document.dispatchEvent(new Event("visibilitychange"));
		now += ms;
		visible = true;
		document.dispatchEvent(new Event("visibilitychange"));
	};
	return { environment, awayFor };
};

const refreshingSession = (scopes: { current: string }) => {
	const forced: boolean[] = [];
	const session = {
		...fakeSession(DID),
		getTokenInfo: async (force: boolean) => {
			forced.push(force);
			return { scope: scopes.current };
		},
	} as unknown as OAuthSession;
	return { session, forced };
};

describe("grant refresh", () => {
	it("re-reads the grant on resume and drops a notice the new grant covers", async () => {
		const scopes = { current: expandedScope({ omitMethods: [GET_CATALOG] }) };
		const { session, forced } = refreshingSession(scopes);
		const resume = fakeResume();
		const { auth } = setup(
			{ stored: session },
			{
				storage: memoryStorage({ sub: DID }),
				resumeEnvironment: resume.environment,
			},
		);
		await auth.init();
		await vi.waitFor(() => expect(forced).toEqual([false, true]));
		expect(auth.scopeNotice()?.methods).toEqual([GET_CATALOG]);

		resume.awayFor(GRANT_REFRESH_AFTER_MS - 1);
		expect(forced).toEqual([false, true]);

		scopes.current = expandedScope();
		resume.awayFor(GRANT_REFRESH_AFTER_MS);
		await vi.waitFor(() => expect(auth.scopeNotice()).toBeUndefined());
		expect(forced).toEqual([false, true, true]);
	});

	it("clears rejections once a refreshed grant differs", async () => {
		const scopes = { current: FULL_SCOPE };
		const { session } = refreshingSession(scopes);
		const resume = fakeResume();
		const { auth } = setup(
			{ stored: session },
			{
				storage: memoryStorage({ sub: DID }),
				resumeEnvironment: resume.environment,
			},
		);
		await auth.init();
		auth.health.noteScopesRejected(LIST_BANS);
		expect(auth.scopeNotice()?.methods).toEqual([LIST_BANS]);
		scopes.current = expandedScope();
		resume.awayFor(GRANT_REFRESH_AFTER_MS);
		await vi.waitFor(() => expect(auth.scopeNotice()).toBeUndefined());
	});

	it("stops refreshing after sign-out", async () => {
		const scopes = { current: FULL_SCOPE };
		const { session, forced } = refreshingSession(scopes);
		const resume = fakeResume();
		const { auth } = setup(
			{ stored: session },
			{
				storage: memoryStorage({ sub: DID }),
				resumeEnvironment: resume.environment,
			},
		);
		await auth.init();
		await vi.waitFor(() => expect(forced).toEqual([false, true]));
		await auth.signOut();
		resume.awayFor(GRANT_REFRESH_AFTER_MS);
		expect(forced).toEqual([false, true]);
	});
});
