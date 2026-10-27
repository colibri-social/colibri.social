import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../data/mock/source";
import {
	BOOT_CAP_MS,
	createDataStore,
	DataContext,
	type DataStore,
} from "../data/store";
import { Providers } from "../providers";
import { ColdStart } from "./boot-gate";
import { MobileShell } from "./MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let store: DataStore | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	host?.remove();
	host = undefined;
	store?.dispose();
	store = undefined;
	setLatency(0);
});

const mountHost = () => {
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	return host;
};

const overlay = () =>
	document.querySelector<HTMLElement>("[data-boot-overlay]");
const content = () =>
	document.querySelector<HTMLElement>("[data-boot-content]");

it("keeps the launch screen up until everything is ready, then hands over once", async () => {
	setLatency(400);
	const root = mountHost();
	const current = createDataStore(createMockSource({ live: false }));
	store = current;
	dispose = render(
		() => (
			<DataContext.Provider value={current}>
				<Providers>
					<ColdStart store={current}>
						<MobileShell />
					</ColdStart>
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	expect(overlay()).not.toBeNull();
	expect(overlay()?.querySelector("[data-launch-screen]")).not.toBeNull();
	expect(content()?.hasAttribute("inert")).toBe(true);
	await new Promise((resolve) => setTimeout(resolve, 200));
	expect(current.bootReady()).toBe(false);
	expect(overlay()?.style.opacity).toBe("1");
	await until(() => current.bootReady());
	await until(() => overlay()?.style.opacity === "0");
	expect(content()?.hasAttribute("inert")).toBe(false);
	expect(
		root.querySelector(
			"[data-boot-content] [data-skeleton], [data-boot-content] [data-skeleton-group]",
		),
	).toBeNull();
	expect(
		root.querySelector("[data-boot-content] [data-space-rail]"),
	).not.toBeNull();
	await until(() => overlay() === null);
});

it("hands over when the Space list fails so the error is visible", async () => {
	const root = mountHost();
	const source = createMockSource({ live: false });
	source.listCommunities = async () => {
		throw new Error("offline");
	};
	const current = createDataStore(source);
	store = current;
	dispose = render(
		() => (
			<DataContext.Provider value={current}>
				<Providers>
					<ColdStart store={current}>
						<MobileShell />
					</ColdStart>
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	await until(() => overlay() === null);
	expect(content()?.hasAttribute("inert")).toBe(false);
});

it("waits for core data in every Space before it is ready", async () => {
	const source = createMockSource({ live: false });
	const listRoles = source.listRoles;
	const held: Array<() => void> = [];
	let last: string | undefined;
	source.listRoles = (community) => {
		if (community !== last) return listRoles(community);
		return new Promise((resolve) => {
			held.push(() => resolve(listRoles(community)));
		});
	};
	const communities = await source.listCommunities();
	last = communities.at(-1)?.did;
	const current = createDataStore(source);
	store = current;
	await until(() => held.length > 0);
	await new Promise((resolve) => setTimeout(resolve, 200));
	expect(current.bootReady()).toBe(false);
	for (const release of held) release();
	await until(() => current.bootReady());
});

it("starts every member list once the core data is in", async () => {
	const source = createMockSource({ live: false });
	const listMembers = source.listMembers;
	const asked = new Set<string>();
	source.listMembers = (community, paging) => {
		asked.add(community);
		return listMembers(community, paging);
	};
	const current = createDataStore(source);
	store = current;
	await until(() => current.bootReady());
	const count = current.communities.value()?.length ?? 0;
	expect(count).toBeGreaterThan(1);
	await until(() => asked.size === count);
});

it("hands over after the cap when a Space never finishes loading", async () => {
	const root = mountHost();
	const source = createMockSource({ live: false });
	source.listUnreadStatus = () => new Promise(() => {});
	const current = createDataStore(source);
	store = current;
	dispose = render(
		() => (
			<DataContext.Provider value={current}>
				<Providers>
					<ColdStart store={current}>
						<MobileShell />
					</ColdStart>
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	await new Promise((resolve) => setTimeout(resolve, BOOT_CAP_MS / 2));
	expect(current.bootReady()).toBe(false);
	expect(overlay()?.style.opacity).toBe("1");
	await until(() => overlay() === null, BOOT_CAP_MS + 2000);
	expect(content()?.hasAttribute("inert")).toBe(false);
});
