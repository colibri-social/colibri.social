import "../../app.css";
import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	type Auth,
	type AuthOptions,
	createAuth,
	type LoadOAuthClient,
} from "../../auth/auth";
import {
	expandedScope,
	type FakeClientState,
	fakeClient,
	fakeSession,
	memoryStorage,
} from "../../auth/testing";
import { Providers } from "../../providers";
import { setOnboardingActive } from "../onboarding/onboarding-state";
import { AuthGate } from "./AuthGate";

const DID = "did:plc:alice";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	sessionStorage.clear();
	history.replaceState(null, "", "/");
	vi.unstubAllGlobals();
});

const stubResolve = (did: string | undefined) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			if (String(input).includes("com.atproto.identity.resolveHandle")) {
				return did
					? Response.json({ did })
					: Response.json({ error: "InvalidRequest" }, { status: 400 });
			}
			return Response.json({ actors: [] });
		}),
	);
};

const mount = async (
	state: Partial<FakeClientState>,
	{
		platform,
		signupPds = null,
		checkSignup,
		...options
	}: Partial<AuthOptions> & {
		platform?: "mobile" | "desktop";
		signupPds?: string | null;
		checkSignup?: (pdsUrl: string) => Promise<boolean>;
	} = {},
) => {
	const fake: FakeClientState = { calls: [], ...state };
	const { load } = fakeClient(fake);
	const host = document.createElement("div");
	document.body.append(host);
	let auth!: Auth;
	const stop = createRoot((disposeRoot) => {
		auth = createAuth({ native: false, loadClient: load, ...options });
		const unmount = render(
			() => (
				<Providers>
					<AuthGate
						auth={auth}
						platform={platform ?? "mobile"}
						search={async () => []}
						signupPds={signupPds}
						checkSignup={checkSignup}
					>
						<main data-testid="signed-in">Signed in as {auth.did()}</main>
					</AuthGate>
				</Providers>
			),
			host,
		);
		return () => {
			unmount();
			disposeRoot();
		};
	});
	dispose = stop;
	await auth.init();
	return { auth, fake };
};

const screenOf = () =>
	document
		.querySelector("[data-onboarding-screen]")
		?.getAttribute("data-onboarding-screen");

describe("sign-in", () => {
	it("walks from welcome to the sign-in form and moves the address to the sign-in path", async () => {
		history.replaceState(null, "", "/app/c/did:plc:space");
		await mount({});
		await expect.poll(screenOf).toBe("welcome");
		expect(location.pathname).toBe("/app/login");
		expect(sessionStorage.getItem("colibri:return-to")).toBe(
			"/app/c/did:plc:space",
		);
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await expect.poll(screenOf).toBe("sign-in");
		const login = page.getByRole("button", { name: "Log in" });
		await expect.element(login).toBeDisabled();
	});

	it("explains a username that doesn't exist in plain words", async () => {
		stubResolve(undefined);
		await mount({});
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.type(page.getByRole("combobox"), "nobody.example{Enter}");
		await expect
			.element(page.getByText(/We couldn't find that username/))
			.toBeVisible();
		const text =
			document.querySelector("[data-sign-in-error]")?.textContent ?? "";
		expect(text).not.toMatch(/handle|DID|PDS|OAuth|AppView/i);
		await userEvent.type(page.getByRole("combobox"), "x");
		await expect
			.poll(() => document.querySelector("[data-sign-in-error]"))
			.toBeNull();
	});

	it("explains in plain words when the account's provider has no Spaces support", async () => {
		stubResolve("did:plc:alice");
		await mount(
			{},
			{ pdsHost: async () => "pds.example", spacesSupport: async () => false },
		);
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.type(page.getByRole("combobox"), "alice.example{Enter}");
		await expect
			.element(page.getByText(/doesn't support Spaces yet/))
			.toBeVisible();
		const text =
			document.querySelector("[data-sign-in-error]")?.textContent ?? "";
		expect(text).toContain("Create an account with a provider");
		expect(text).not.toMatch(/handle|DID|PDS|OAuth|AppView|server/i);
	});

	it("shows the button as busy while handing off", async () => {
		stubResolve(DID);
		const { fake } = await mount({});
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.type(page.getByRole("combobox"), "alice.example{Enter}");
		await expect
			.poll(() => fake.calls.some((call) => call.method === "signIn"))
			.toBe(true);
		const button = document.querySelector<HTMLButtonElement>(
			"button[type='submit']",
		);
		expect(
			button?.getAttribute("aria-busy") === "true" ||
				button?.disabled === true ||
				button?.hasAttribute("data-loading"),
		).toBe(true);
	});

	it("hides account creation when no sign-up server is set", async () => {
		await mount({});
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await expect.poll(screenOf).toBe("sign-in");
		expect(
			[...document.querySelectorAll("button")].some(
				(button) => button.textContent?.trim() === "Create account",
			),
		).toBe(false);
	});

	it("starts sign-up on the configured server", async () => {
		const checkSignup = vi.fn(async () => true);
		const { fake } = await mount(
			{},
			{ signupPds: "https://pds.example", checkSignup },
		);
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.click(page.getByRole("button", { name: "Create account" }));
		await expect.poll(screenOf).toBe("create-account");
		await expect
			.element(
				page.getByRole("heading", { name: "Create an account on pds.example" }),
			)
			.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Open browser" }));
		expect(checkSignup).toHaveBeenCalledWith("https://pds.example");
		await expect
			.poll(() => fake.calls.find((call) => call.method === "signIn"))
			.toMatchObject({
				input: "https://pds.example",
				options: expect.objectContaining({ prompt: "create" }),
			});
	});

	it("explains in plain words when the server can't create accounts", async () => {
		const { fake } = await mount(
			{},
			{ signupPds: "https://pds.example", checkSignup: async () => false },
		);
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.click(page.getByRole("button", { name: "Create account" }));
		await userEvent.click(page.getByRole("button", { name: "Open browser" }));
		const errorText = () =>
			document.querySelector("[data-create-account-error]")?.textContent ?? "";
		await expect.poll(errorText).toContain("Sign-up isn't available right now");
		expect(errorText()).not.toMatch(/pds|oauth|prompt|server|metadata/i);
		expect(fake.calls.some((call) => call.method === "signIn")).toBe(false);
		await userEvent.click(page.getByRole("button", { name: "Back" }));
		await expect.poll(screenOf).toBe("sign-in");
	});

	it("shows the app once signed in", async () => {
		await mount(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await expect.element(page.getByTestId("signed-in")).toHaveTextContent(DID);
		expect(screenOf()).toBeUndefined();
	});

	it("shows the launch screen while starting, then a retry when starting hangs", async () => {
		const { client } = fakeClient({ calls: [], stored: fakeSession(DID) });
		let attempts = 0;
		const loadClient: LoadOAuthClient = async () => {
			attempts += 1;
			if (attempts > 1) return client;
			return { ...client, init: () => new Promise<never>(() => {}) };
		};
		const mounting = mount(
			{},
			{
				loadClient,
				startupTimeoutMs: 150,
				storage: memoryStorage({ sub: DID }),
			},
		);
		expect(document.querySelector("[data-launch-screen]")).not.toBeNull();
		await mounting;
		expect(document.querySelector("[data-launch-screen]")).toBeNull();
		await expect
			.element(page.getByText("Colibri can't connect right now"))
			.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		await expect.element(page.getByTestId("signed-in")).toHaveTextContent(DID);
	});

	it("sends an expired session back to sign-in and remembers where it was", async () => {
		history.replaceState(null, "", "/app/inbox");
		const { auth } = await mount(
			{ stored: fakeSession(DID) },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await expect.element(page.getByTestId("signed-in")).toBeVisible();
		auth.onAuthFailure("ExpiredToken");
		await expect.poll(screenOf).toBe("sign-in");
		expect(document.querySelector("[data-testid='signed-in']")).toBeNull();
		await expect.element(page.getByText(/Please sign in again/)).toBeVisible();
		expect(location.pathname).toBe("/app/login");
		expect(sessionStorage.getItem("colibri:return-to")).toBe("/app/inbox");
	});

	it("asks for a quick approval when access is missing", async () => {
		const { fake } = await mount(
			{ stored: fakeSession(DID, "atproto") },
			{ storage: memoryStorage({ sub: DID }) },
		);
		await expect.poll(screenOf).toBe("reapprove");
		await expect
			.element(
				page.getByRole("heading", { name: "Colibri needs a quick approval" }),
			)
			.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Continue" }));
		await expect
			.poll(() => fake.calls.find((call) => call.method === "signIn")?.input)
			.toBe(DID);
	});

	it("shows a notice over the app when an approved set gained a method", async () => {
		const scope = expandedScope({
			omitMethods: ["social.colibri.beta.emoji.getCatalog"],
		});
		const { fake } = await mount(
			{ stored: fakeSession(DID, scope) },
			{
				storage: memoryStorage({ sub: DID }),
				pdsHost: async () => undefined,
				resumeEnvironment: null,
			},
		);
		await expect.element(page.getByTestId("signed-in")).toBeVisible();
		expect(screenOf()).toBeUndefined();
		const notice = page.getByRole("status").filter({
			hasText: "Colibri needs one more permission for custom emoji.",
		});
		await expect.element(notice).toBeVisible();
		const slot = document.querySelector("[data-permission-notice-slot]");
		expect(slot?.hasAttribute("inert")).toBe(false);
		stubResolve(DID);
		await userEvent.click(page.getByRole("button", { name: "Review" }));
		await expect
			.poll(() => fake.calls.find((call) => call.method === "signIn")?.input)
			.toBe(DID);
	});

	it("keeps the notice hidden while onboarding runs", async () => {
		const scope = expandedScope({
			omitMethods: ["social.colibri.beta.emoji.getCatalog"],
		});
		setOnboardingActive(true);
		try {
			await mount(
				{ stored: fakeSession(DID, scope) },
				{
					storage: memoryStorage({ sub: DID }),
					resumeEnvironment: null,
				},
			);
			await expect.element(page.getByTestId("signed-in")).toBeVisible();
			const slot = () =>
				document.querySelector("[data-permission-notice-slot]");
			await expect.poll(() => slot()?.hasAttribute("inert")).toBe(true);
			setOnboardingActive(false);
			await expect.poll(() => slot()?.hasAttribute("inert")).toBe(false);
		} finally {
			setOnboardingActive(false);
		}
	});

	it("hides the notice for the session once dismissed", async () => {
		const scope = expandedScope({
			omitMethods: ["social.colibri.beta.emoji.getCatalog"],
		});
		await mount(
			{ stored: fakeSession(DID, scope) },
			{
				storage: memoryStorage({ sub: DID }),
				resumeEnvironment: null,
			},
		);
		await userEvent.click(page.getByRole("button", { name: "Dismiss" }));
		await expect
			.poll(() =>
				document
					.querySelector("[data-permission-notice-slot]")
					?.hasAttribute("inert"),
			)
			.toBe(true);
		await expect.element(page.getByTestId("signed-in")).toBeVisible();
	});

	it("keeps the full-screen approval when a whole set is missing", async () => {
		const scope = expandedScope({
			omitSets: ["social.colibri.beta.permissionMessaging"],
		});
		await mount(
			{ stored: fakeSession(DID, scope) },
			{
				storage: memoryStorage({ sub: DID }),
				resumeEnvironment: null,
			},
		);
		await expect.poll(screenOf).toBe("reapprove");
		expect(document.querySelector("[data-testid='signed-in']")).toBeNull();
		expect(document.querySelector("[data-permission-notice]")).toBeNull();
	});

	it("waits for the browser where the native sheet isn't available", async () => {
		stubResolve(DID);
		const openBrowser = vi.fn();
		await mount(
			{},
			{
				native: true,
				openBrowser,
				webAuth: async () => {
					throw { code: "Unsupported", message: "unsupported" };
				},
			},
		);
		await userEvent.click(page.getByRole("button", { name: "Start setup" }));
		await userEvent.type(page.getByRole("combobox"), "alice.example{Enter}");
		await expect.poll(screenOf).toBe("browser");
		expect(openBrowser).toHaveBeenCalledOnce();
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		await expect.poll(() => openBrowser.mock.calls.length).toBe(2);
		expect(screenOf()).toBe("browser");
		await userEvent.click(page.getByRole("button", { name: "Back" }));
		await expect.poll(screenOf).toBe("sign-in");
	});

	it("uses the split layout on desktop", async () => {
		await mount({}, { platform: "desktop" });
		await expect.poll(screenOf).toBe("welcome");
		expect(
			document.querySelector("[data-onboarding][data-platform='desktop']"),
		).not.toBeNull();
		const steps = [...document.querySelectorAll("[data-onboarding-step]")].map(
			(step) => step.getAttribute("data-onboarding-step"),
		);
		expect(steps).toEqual(["welcome", "sign-in"]);
	});
});
