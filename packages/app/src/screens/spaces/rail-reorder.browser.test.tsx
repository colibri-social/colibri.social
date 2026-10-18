import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SPACE_ORDER_NOT_SAVED } from "../../data/error-copy";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { Did } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";

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
	const store = createDataStore(createMockSource({ live: false }));
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
	return store;
};

const railOrder = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>("[data-space-rail] [data-rail-id]"),
	).map((element) => element.dataset.railId ?? "");

const railButton = (did: string) =>
	document.querySelector<HTMLElement>(
		`[data-rail-id="${did}"] [data-rail-focusable]`,
	) as HTMLElement;

it("moves a Space with Alt and an arrow key and saves the order to synced preferences", async () => {
	const store = await mount();
	await expect.poll(() => railOrder().length).toBeGreaterThan(1);
	const before = railOrder();
	const [first, second] = before;
	if (!first || !second) throw new Error("the mock world needs two Spaces");

	railButton(first).focus();
	await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");

	const expected = [second, first, ...before.slice(2)];
	await expect.poll(railOrder).toEqual(expected);
	expect(store.preferences.communityOrder()).toEqual(expected);
	await expect.poll(() => document.activeElement).toBe(railButton(first));
	await store.preferences.settled();
	expect(store.preferences.communityOrder()).toEqual(expected);
});

it("puts the Spaces back and explains it when the new order can't be saved", async () => {
	const store = await mount();
	await expect.poll(() => railOrder().length).toBeGreaterThan(1);
	const before = railOrder();
	const [first] = before;
	if (!first) throw new Error("the mock world needs a Space");
	const preferences = store.preferences;
	preferences.setCommunityOrder = async (order: readonly Did[]) => {
		preferences.adopt({
			...preferences.preferences(),
			communityOrder: [...order],
		});
		return false;
	};

	railButton(first).focus();
	await userEvent.keyboard("{Alt>}{End}{/Alt}");

	await expect
		.poll(() => document.body.textContent ?? "")
		.toContain(SPACE_ORDER_NOT_SAVED.title);
	await expect.poll(railOrder).toEqual(before);
	expect(preferences.communityOrder()).toEqual(before);
	await expect
		.poll(
			() =>
				document.querySelector("[data-space-rail] [role=status]")
					?.textContent ?? "",
		)
		.toContain("Couldn't move");
});
