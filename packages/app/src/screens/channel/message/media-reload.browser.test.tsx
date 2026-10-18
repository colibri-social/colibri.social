import { MediaGrid, type MediaItem } from "@colibri-social/ui";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import "../../../app.css";

const RED =
	"data:image/gif;base64,R0lGODlhAQABAIAAAP8AAAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
const WHITE =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
});

const mount = (initial: MediaItem) => {
	const [items, setItems] = createSignal<MediaItem[]>([initial]);
	host = document.createElement("div");
	document.body.append(host);
	stop = render(() => <MediaGrid items={items()} />, host);
	return { root: host, setItems };
};

const settled = async (root: HTMLElement) => {
	await expect
		.poll(() => root.querySelector("[data-media-tile] img")?.className)
		.toContain("opacity-100");
};

it("keeps a loaded image visible when its item is rebuilt with the same src", async () => {
	const { root, setItems } = mount({ src: RED, width: 300, height: 200 });
	await settled(root);

	setItems([{ src: RED, width: 300, height: 200 }]);
	await Promise.resolve();

	const image = root.querySelector("[data-media-tile] img");
	expect(image?.className).toContain("opacity-100");
	expect(root.querySelector("[data-skeleton]")).toBeNull();
});

it("shows the skeleton again when the src changes", async () => {
	const { root, setItems } = mount({ src: RED, width: 300, height: 200 });
	await settled(root);

	setItems([{ src: WHITE, width: 300, height: 200 }]);
	await Promise.resolve();

	expect(root.querySelector("[data-skeleton]")).toBeTruthy();
	await settled(root);
});
