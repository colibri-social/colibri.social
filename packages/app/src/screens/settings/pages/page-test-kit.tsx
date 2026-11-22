import "../../../app.css";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";

let dispose: (() => void) | undefined;
let store: ReturnType<typeof createDataStore> | undefined;

export const cleanup = () => {
	dispose?.();
	dispose = undefined;
	store?.dispose();
	store = undefined;
	document.body.replaceChildren();
};

export const mountPage = async (
	view: () => JSX.Element,
	size: { width: number; height: number } = { width: 402, height: 874 },
) => {
	setLatency(0);
	await page.viewport(size.width, size.height);
	const data = createDataStore(createMockSource({ live: false }));
	store = data;
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;overflow:auto;padding:16px";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={data}>
				<Providers>{view()}</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { store: data, host };
};
