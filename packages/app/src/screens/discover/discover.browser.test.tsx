import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DISCOVERY_ENABLED } from "../../shell/features";
import { MobileShell } from "../../shell/MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout)
			throw new Error(`Timed out: ${check.toString().slice(0, 120)}`);
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
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
	return { store, source, root: host };
};

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const discoverScreen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-discover]");

const dialogNamed = (name: string | RegExp) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => {
			const label = element.getAttribute("aria-label") ?? "";
			return typeof name === "string" ? label === name : name.test(label);
		},
	);

describe.skipIf(!DISCOVERY_ENABLED)("discover Spaces", () => {
	it("opens the feed from the rail, previews a Space and joins it", async () => {
		const { root, store } = await mount("/app");
		await until(() => !!buttonNamed(root, "Discover Spaces"));
		buttonNamed(root, "Discover Spaces")?.click();
		await until(() => location.pathname === "/app/discover");
		await until(() => !!discoverScreen(root));
		const view = discoverScreen(root) as HTMLElement;
		await until(() => !!buttonNamed(view, /^Colibri Social Flock/));
		expect(view.querySelector("h1")?.textContent?.trim()).toBe(
			"Discovery Feed",
		);
		buttonNamed(view, /^Colibri Social Flock/)?.click();
		await until(() => !!dialogNamed("Colibri Social Flock"));
		const sheet = dialogNamed("Colibri Social Flock") as HTMLElement;
		await until(() => !!buttonNamed(sheet, "Join this Space"));
		expect(sheet.querySelector("[data-developer-mode]")).toBeNull();
		await wait(400);
		expect(layoutIssues(sheet)).toEqual([]);
		buttonNamed(sheet, "Join this Space")?.click();
		await until(() => !!buttonNamed(sheet, "Open Space"));
		expect(
			store.communities
				.value()
				?.some((entry) => entry.did === "did:plc:colibriflock7k2m4n6p8q"),
		).toBe(true);
		await until(
			() => !sheet.querySelector('[data-join-action] [aria-busy="true"]'),
		);
		await wait(100);
		buttonNamed(sheet, "Open Space")?.click();
		await until(() =>
			location.pathname.startsWith("/app/c/did:plc:colibriflock7k2m4n6p8q"),
		);
	});

	it("shows the developer card in the preview with developer mode on", async () => {
		const { root, store } = await mount("/app/discover");
		store.setControls({ developerMode: true });
		await until(() => !!discoverScreen(root));
		const view = discoverScreen(root) as HTMLElement;
		await until(() => !!buttonNamed(view, /^Modular Synth Club/));
		buttonNamed(view, /^Modular Synth Club/)?.click();
		await until(() => !!dialogNamed("Modular Synth Club"));
		const sheet = dialogNamed("Modular Synth Club") as HTMLElement;
		await until(() => !!sheet.querySelector("[data-developer-mode]"));
		expect(buttonNamed(sheet, /Copy DID/)).toBeTruthy();
		await wait(400);
		expect(layoutIssues(sheet)).toEqual([]);
	});
});
