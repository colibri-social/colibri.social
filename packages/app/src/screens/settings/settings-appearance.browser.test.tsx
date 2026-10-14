import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import SettingsScreen from "./settings.screen";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
});

it("has an Appearance group with the message preview toggle on mobile", async () => {
	setLatency(0);
	await page.viewport(402, 874);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<SettingsScreen args={{}} />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await expect
		.element(page.getByText("Appearance", { exact: true }))
		.toBeVisible();
	const toggle = page.getByRole("switch", { name: /Show message previews/ });
	await expect.element(toggle).toBeChecked();
	await userEvent.click(page.getByText("Show message previews"));
	await expect.poll(() => store.controls().showMessagePreviews).toBe(false);
});
