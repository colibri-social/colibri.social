import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { ProfileSheetProvider, useProfileSheet } from "./profile-sheet";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
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

const mount = async (path: string, developerMode: boolean) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	store.setControls({ developerMode });
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
	return { store, root: host };
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const pdslsLink = (scope: ParentNode) =>
	Array.from(scope.querySelectorAll<HTMLAnchorElement>("a")).find(
		(link) => link.textContent?.trim() === "Show on PDSls",
	);

const copyDid = (scope: ParentNode) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(button) => button.textContent?.trim() === "Copy DID",
	);

const openRailDrawer = async (root: HTMLElement) => {
	await until(() =>
		Array.from(
			root.querySelectorAll<HTMLElement>("[data-space-rail] button"),
		).some((element) => element.textContent?.includes("Colibri HQ")),
	);
	await wait(400);
	const item = Array.from(
		root.querySelectorAll<HTMLElement>("[data-space-rail] button"),
	).find((element) => element.textContent?.includes("Colibri HQ"));
	item?.dispatchEvent(
		new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
	);
	await until(() => !!dialog());
	await wait(400);
	return dialog() as HTMLElement;
};

describe("developer mode cards", () => {
	it("shows the viewer's DID on the Profile tab only in developer mode", async () => {
		const { root, store } = await mount("/app/profile", false);
		await until(() => !!root.textContent?.includes("Edit profile"));
		expect(pdslsLink(root)).toBeUndefined();
		store.setControls({ developerMode: true });
		await until(() => !!pdslsLink(root));
		expect(pdslsLink(root)?.href).toBe(
			`https://pdsls.dev/at://${store.viewer.did}`,
		);
		expect(copyDid(root)).toBeTruthy();
		await expectNoLayoutIssues(
			root.querySelector<HTMLElement>("[data-scroll-y]") ?? root,
		);
	});

	it("adds the Space DID to the Space drawer in developer mode", async () => {
		const { root } = await mount(`/app/c/${HQ}`, true);
		const drawer = await openRailDrawer(root);
		await until(() => !!pdslsLink(drawer));
		expect(pdslsLink(drawer)?.href).toBe(`https://pdsls.dev/at://${HQ}`);
		expect(copyDid(drawer)).toBeTruthy();
		await expectNoLayoutIssues(drawer);
	});

	it("leaves the Space drawer without the card outside developer mode", async () => {
		const { root } = await mount(`/app/c/${HQ}`, false);
		const drawer = await openRailDrawer(root);
		expect(pdslsLink(drawer)).toBeUndefined();
		expect(copyDid(drawer)).toBeUndefined();
	});

	it("shows another member's DID in the profile popover only in developer mode", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		const store = createDataStore(createMockSource({ live: false }));
		store.setControls({ developerMode: false });
		await until(() => !!store.communities.value());
		const hq = store.spaceByKey(HQ);
		if (!hq) throw new Error("hq missing");
		const space = store.space(hq);
		await until(() => !!space.members.value());
		const other = space.members
			.value()
			?.find((member) => member.actor.did !== store.viewer.did);
		if (!other) throw new Error("no other member");
		let open: ReturnType<typeof useProfileSheet>["open"] = () => {};
		let anchor: HTMLButtonElement | undefined;
		const Capture = () => {
			open = useProfileSheet().open;
			return null;
		};
		host = document.createElement("div");
		host.style.cssText = "position:fixed;inset:0;width:1440px;height:900px";
		document.body.append(host);
		stop = render(
			() => (
				<DataContext.Provider value={store}>
					<Providers>
						<ProfileSheetProvider>
							<Capture />
							<button type="button" ref={anchor} style={{ margin: "200px" }}>
								Anchor
							</button>
						</ProfileSheetProvider>
					</Providers>
				</DataContext.Provider>
			),
			host,
		);
		open(other.actor.did, HQ, { element: anchor });
		await until(() => !!document.querySelector("[data-profile-link]"));
		expect(pdslsLink(document)).toBeUndefined();
		expect(copyDid(document)).toBeUndefined();
		store.setControls({ developerMode: true });
		await until(() => !!pdslsLink(document));
		expect(pdslsLink(document)?.href).toBe(
			`https://pdsls.dev/at://${other.actor.did}`,
		);
	});
});
