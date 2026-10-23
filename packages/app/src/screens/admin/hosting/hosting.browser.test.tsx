import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import type { HostingView } from "../../../data/hosting";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import type { Did } from "../../../data/types";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;
const HOSTING = `/app/c/${HQ}/manage/hosting`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout)
			throw new Error(`Timed out: ${check.toString().slice(0, 120)}`);
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";
let originalOpen: typeof window.open;

beforeEach(() => {
	originalPath = location.pathname + location.search;
	originalOpen = window.open;
	window.open = (() => null) as typeof window.open;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
	window.open = originalOpen;
});

const mount = async (
	path: string,
	hosting?: Record<string, Partial<HostingView>>,
) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false, hosting });
	const store = createDataStore(source);
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(() => !store.communities.loading());
	return { source, store, root: host };
};

const page = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-admin-hosting]");

const buttonNamed = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const NEEDS_SIGN_IN: Record<string, Partial<HostingView>> = {
	[HQ]: {
		kind: "own",
		account: "hq.example.com",
		server: "https://example.com",
		needsSignIn: true,
		needsSignInSince: "2026-10-21T00:00:00.000Z",
	},
};

describe("Space hosting", () => {
	it("shows where a Space hosted by Colibri lives", async () => {
		const { root } = await mount(HOSTING);
		await until(() =>
			(page(root)?.textContent ?? "").includes("Managed for you"),
		);
		const view = page(root) as HTMLElement;
		expect(view.textContent).toContain("Hosted by Colibri");
		expect(view.textContent).toContain("spaces-alpha.colibri.social");
		expect(buttonNamed(view, "Move to another server")).toBeUndefined();
		await expectNoLayoutIssues(view);
	});

	it("asks the owner to sign in again and reconnects the Space", async () => {
		const { root } = await mount(HOSTING, NEEDS_SIGN_IN);
		await until(() => !!page(root)?.querySelector("[role='alert']"));
		const view = page(root) as HTMLElement;
		expect(view.textContent).toContain("Needs sign-in");
		buttonNamed(view, "Sign in as hq.example.com")?.click();
		await until(
			() => (page(root)?.textContent ?? "").includes("Connected"),
			8000,
		);
		expect(page(root)?.querySelector("[role='alert']")).toBeNull();
	});

	it("marks the Space for its owner while a sign-in is needed", async () => {
		const { root } = await mount(`/app/c/${HQ}`, NEEDS_SIGN_IN);
		await until(
			() =>
				!!Array.from(root.querySelectorAll("button")).find((element) =>
					(element.getAttribute("aria-label") ?? "").endsWith(
						"Space options, needs your attention",
					),
				),
		);
		expect(root.querySelector("[data-rail-attention]")).not.toBeNull();
	});
});
