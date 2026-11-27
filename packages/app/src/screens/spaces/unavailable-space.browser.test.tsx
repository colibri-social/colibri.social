import "../../app.css";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import type { UnavailableCommunity } from "../../data/source";
import { appViewHost, createDataStore, DataContext } from "../../data/store";
import type { CommunityView, Did } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const REMOTE_APP = "did:web:market.example.org";
const NEVER_SEEN = "did:plc:neverseenxxxxxxxxxxxxxxx" as Did;

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	setLatency(0);
	document.body.replaceChildren();
});

const mount = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `/app/c/${HQ}/${TEXT}/general`);

	const source = createMockSource({ live: false });
	const list = source.listCommunities.bind(source);

	const [unavailable, setUnavailable] = createSignal<
		readonly UnavailableCommunity[]
	>([]);

	let hidden = new Set<string>();

	const listCommunities = vi.fn(async () => {
		const views = await list();

		return views.filter((view) => !hidden.has(view.did));
	});

	Object.assign(source, {
		unavailableCommunities: unavailable,
		listCommunities,
	});

	const store = createDataStore(source);
	const host = document.createElement("div");

	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);

	const goUnreachable = async (entries: UnavailableCommunity[]) => {
		hidden = new Set(entries.map((entry) => entry.did));
		setUnavailable(entries);
		await store.communities.refresh();
	};

	return { store, listCommunities, goUnreachable };
};

const railButton = (name: RegExp) => page.getByRole("button", { name });

it("names the host of an AppView by its did:web", () => {
	expect(appViewHost(REMOTE_APP)).toBe("market.example.org");
	expect(appViewHost("did:web:localhost%3A3000")).toBe("localhost:3000");
	expect(appViewHost("did:plc:abc")).toBe("did:plc:abc");
});

it("keeps an unreachable Space in the rail under its last known name and explains it", async () => {
	const { store, listCommunities, goUnreachable } = await mount();

	await expect
		.poll(() => (store.communities.value() ?? []).length)
		.toBeGreaterThan(1);

	const target = (store.communities.value() ?? []).find(
		(view) => view.did !== HQ,
	) as CommunityView;

	await goUnreachable([{ did: target.did, managingApp: REMOTE_APP }]);

	const item = railButton(
		new RegExp(`^${target.name}, can't be reached right now`),
	);

	await expect.element(item).toBeVisible();
	await userEvent.click(item);
	await expect
		.element(
			page.getByRole("heading", {
				name: `${target.name} can't be reached right now`,
			}),
		)
		.toBeVisible();
	await expect
		.element(page.getByText(/hosted by market\.example\.org/))
		.toBeVisible();

	const calls = listCommunities.mock.calls.length;

	await userEvent.click(page.getByRole("button", { name: "Try again" }));
	await expect
		.poll(() => listCommunities.mock.calls.length)
		.toBeGreaterThan(calls);
});

it("calls a Space it has never loaded This Space", async () => {
	const { goUnreachable } = await mount();

	await goUnreachable([{ did: NEVER_SEEN, managingApp: REMOTE_APP }]);
	await expect
		.element(railButton(/^This Space, can't be reached right now/))
		.toBeVisible();
});

it("checks again every minute while a Space can't be reached", async () => {
	const { listCommunities, goUnreachable } = await mount();

	await goUnreachable([{ did: NEVER_SEEN, managingApp: REMOTE_APP }]);
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

	try {
		await goUnreachable([]);
		await goUnreachable([{ did: NEVER_SEEN, managingApp: REMOTE_APP }]);

		const calls = listCommunities.mock.calls.length;

		vi.advanceTimersByTime(60_000);
		await expect
			.poll(() => listCommunities.mock.calls.length)
			.toBeGreaterThan(calls);
	} finally {
		vi.useRealTimers();
	}
});
