import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import type { CommunityView } from "../data/types";
import { Providers } from "../providers";
import { usePlatform } from "../screen/platform";
import { DesktopShell } from "./desktop/DesktopShell";
import { DISCOVERY_ENABLED } from "./features";
import { MobileShell } from "./MobileShell";

const TITLE = "You're not in any Spaces yet";

type Source = ReturnType<typeof createMockSource>;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();

	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const withoutSpaces = (source: Source) => {
	source.listCommunities = () => Promise.resolve([]);
};

const mount = async (options: {
	desktop?: boolean;
	prepare?: (source: Source) => void;
}) => {
	setLatency(0);
	await page.viewport(
		options.desktop ? 1440 : 402,
		options.desktop ? 900 : 874,
	);

	const platform = usePlatform();

	await until(() => (platform() === "desktop") === !!options.desktop);
	history.replaceState(null, "", "/app");

	const source = createMockSource({ live: false });

	options.prepare?.(source);

	const store = createDataStore(source);
	const host = document.createElement("div");

	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);

	const Shell = options.desktop ? DesktopShell : MobileShell;

	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<Shell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);

	return { store, host };
};

const screenButton = (name: string) => {
	return page
		.getByRole("status")
		.filter({ hasText: TITLE })
		.getByRole("button", { name, exact: true });
};

const sidebar = (host: HTMLElement) => {
	return host.querySelector<HTMLElement>("[data-shell-sidebar]");
};

describe("no Spaces", () => {
	it("hides the channel list on desktop and fills the main area", async () => {
		const { host } = await mount({ desktop: true, prepare: withoutSpaces });

		await expect
			.element(page.getByRole("heading", { name: TITLE }))
			.toBeVisible();
		expect(host.querySelector("[data-shell-main]")?.textContent).toContain(
			TITLE,
		);
		expect(sidebar(host)?.hidden).toBe(true);
		expect(host.textContent).not.toContain("No channel open");
		await expect.element(screenButton("Create a Space")).toBeVisible();
		await expect
			.element(page.getByRole("region", { name: "Your account" }))
			.toBeVisible();
		expect(screenButton("Discover Spaces").elements().length).toBe(
			DISCOVERY_ENABLED ? 1 : 0,
		);
	});

	it("opens the create flow from the desktop screen", async () => {
		await mount({ desktop: true, prepare: withoutSpaces });
		await userEvent.click(screenButton("Create a Space"));
		await expect.poll(() => location.pathname).toBe("/app/new");
	});

	it("keeps the channel list while Spaces are loading on desktop", async () => {
		let resolve: ((list: CommunityView[]) => void) | undefined;
		const { host, store } = await mount({
			desktop: true,
			prepare: (source) => {
				source.listCommunities = () =>
					new Promise((done) => {
						resolve = done;
					});
			},
		});

		await until(() => !!sidebar(host));
		expect(store.communities.loading()).toBe(true);
		expect(sidebar(host)?.hidden).toBe(false);
		expect(host.textContent).not.toContain(TITLE);
		resolve?.([]);
		await expect
			.element(page.getByRole("heading", { name: TITLE }))
			.toBeVisible();
		expect(sidebar(host)?.hidden).toBe(true);
	});

	it("keeps the channel list when the Spaces fail to load on desktop", async () => {
		const { host } = await mount({
			desktop: true,
			prepare: (source) => {
				source.listCommunities = () =>
					Promise.reject(new TypeError("Failed to fetch"));
			},
		});

		await expect
			.element(page.getByRole("heading", { name: "Your Spaces didn't load" }))
			.toBeVisible();
		expect(sidebar(host)?.hidden).toBe(false);
		expect(host.textContent).not.toContain(TITLE);
	});

	it("shows the screen next to the rail on mobile", async () => {
		const { host } = await mount({ prepare: withoutSpaces });

		await expect
			.element(page.getByRole("heading", { name: TITLE }))
			.toBeVisible();
		expect(host.querySelector("[data-scroll-y]")?.textContent).toContain(TITLE);
		await userEvent.click(screenButton("Create a Space"));
		await expect.poll(() => location.pathname).toBe("/app/new");
	});
});
