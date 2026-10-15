import { ColibriError } from "@colibri-social/lib";
import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AuthOptions, createAuth, type LoadOAuthClient } from "./auth";
import {
	type FakeClientState,
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
