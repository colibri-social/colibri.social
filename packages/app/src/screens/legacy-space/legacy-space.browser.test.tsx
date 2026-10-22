import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutIssues } from "../../../../ui/src/foundations/layout-test";
import { SAMPLE_LEGACY_COMMUNITIES } from "../../data/mock/legacy";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

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

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({
		live: false,
		legacyCommunities: SAMPLE_LEGACY_COMMUNITIES,
	});
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
	await until(() => !store.communities.loading() && !store.legacy.loading());
	return { store, source, root: host };
};

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const railItem = (root: HTMLElement, name: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>("[data-space-rail] [data-rail-item]"),
	).find((item) => {
		const label = item.querySelector(".sr-only")?.textContent ?? "";
		return label === name || label.startsWith(`${name},`);
	});

const screen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-legacy-space-screen]");

const OWLS = SAMPLE_LEGACY_COMMUNITIES[0]?.did ?? "";

describe("legacy communities", () => {
	it("shows every legacy community as a locked rail entry", async () => {
		const { root } = await mount("/app");
		await until(() => !!railItem(root, "Wren Corner"));
		for (const name of ["Owl Roost", "Finch Club", "Wren Corner"]) {
			const item = railItem(root, name) as HTMLElement;
			expect(item.querySelector("[data-rail-locked]")).not.toBeNull();
			expect(item.textContent).toContain("not on Spaces yet");
		}
	});

	it("lets an admin review and move a community, then opens the Space", async () => {
		const { root, store } = await mount("/app");
		await until(() => !!railItem(root, "Owl Roost"));
		(
			railItem(root, "Owl Roost")?.querySelector("button") as HTMLElement
		).click();
		await until(
			() =>
				location.pathname === `/app/legacy/${encodeURIComponent(OWLS)}` &&
				!!screen(root),
		);
		const view = screen(root) as HTMLElement;
		expect(view.textContent).toContain("Move Owl Roost to Spaces");
		buttonNamed(view, "Review the move")?.click();
		await until(() => (view.textContent ?? "").includes("Stays behind"));
		await wait(300);
		expect(layoutIssues(view)).toEqual([]);
		buttonNamed(view, "Move to Spaces")?.click();
		await until(() => (view.textContent ?? "").includes("Moving Owl Roost"));
		await until(
			() =>
				!!railItem(root, "Owl Roost")?.querySelector(
					'[data-rail-locked="moving"]',
				),
		);
		await until(() => location.pathname.startsWith("/app/c/did:plc:"), 10000);
		const did = location.pathname.split("/")[3] ?? "";
		const moved = store.spaceByKey(did);
		expect(moved?.name).toBe("Owl Roost");
		expect(moved?.migration?.by).toBeTruthy();
		expect(store.legacy.byDid(OWLS)).toBeUndefined();
		expect(
			railItem(root, "Owl Roost")?.querySelector("[data-rail-locked]"),
		).toBeFalsy();
	});

	it("tells a member who to ask", async () => {
		const { root } = await mount("/app");
		await until(() => !!railItem(root, "Finch Club"));
		(
			railItem(root, "Finch Club")?.querySelector("button") as HTMLElement
		).click();
		await until(() => !!screen(root));
		const view = screen(root) as HTMLElement;
		expect(view.textContent).toContain("Finch Club isn't on Spaces yet");
		expect(view.textContent).toContain("@finch.bsky.social");
		expect(buttonNamed(view, "Review the move")).toBeUndefined();
		await wait(300);
		expect(layoutIssues(view)).toEqual([]);
	});

	it("removes a community that can't move from the rail", async () => {
		const { root, store } = await mount("/app");
		await until(() => !!railItem(root, "Wren Corner"));
		(
			railItem(root, "Wren Corner")?.querySelector("button") as HTMLElement
		).click();
		await until(() => !!screen(root));
		const view = screen(root) as HTMLElement;
		expect(view.textContent).toContain("early version of Colibri");
		buttonNamed(view, "Remove from sidebar")?.click();
		await until(() => !railItem(root, "Wren Corner"));
		expect(store.preferences.client().dismissedLegacyCommunities).toContain(
			SAMPLE_LEGACY_COMMUNITIES[2]?.did,
		);
		await until(() => !location.pathname.startsWith("/app/legacy"));
	});
});
