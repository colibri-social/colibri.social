import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../data/store";
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
