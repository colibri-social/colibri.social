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

	expect(root.querySelector("[data-skeleton]")).toBeTruthy();
	expect(root.querySelector("[data-media-tile] img")?.className).toContain(
		"opacity-0",
	);
	await settled(root);
});

it("keeps every grid tile's image node when the items are rebuilt", async () => {
	const [items, setItems] = createSignal<MediaItem[]>([
		{ src: RED, width: 300, height: 200 },
		{ src: WHITE, width: 300, height: 200 },
	]);
	host = document.createElement("div");
	document.body.append(host);
	const root = host;
	stop = render(() => <MediaGrid items={items()} />, root);
	const images = () =>
		Array.from(root.querySelectorAll("[data-media-tile] img"));
	await expect
		.poll(() =>
			images().map((image) => image.className.includes("opacity-100")),
		)
		.toEqual([true, true]);
	const before = images();

	setItems([
		{ src: RED, width: 300, height: 200 },
		{ src: WHITE, width: 300, height: 200 },
	]);
	await Promise.resolve();

	expect(images()).toEqual(before);
	expect(images()[0]).toBe(before[0]);
	expect(images()[1]).toBe(before[1]);
	expect(root.querySelector("[data-skeleton]")).toBeNull();
});

it("keeps a video poster loaded when only the video link changes", async () => {
	const video = (src: string): MediaItem => ({
		src,
		kind: "video",
		poster: RED,
		spoiler: true,
		width: 300,
		height: 200,
	});
	const { root, setItems } = mount(video("https://media.test/a.webm"));
	await settled(root);
	const image = root.querySelector("[data-media-tile] img");

	setItems([video("https://media.test/b.webm")]);
	await Promise.resolve();

	expect(root.querySelector("[data-media-tile] img")).toBe(image);
	expect(image?.className).toContain("opacity-100");
	expect(root.querySelector("[data-skeleton]")).toBeNull();
});

it("clears the skeleton of a fresh tile over an already loaded image", async () => {
	const first = mount({ src: RED, width: 300, height: 200 });
	await settled(first.root);
	const second = document.createElement("div");
	document.body.append(second);
	const dispose = render(
		() => <MediaGrid items={[{ src: RED, width: 300, height: 200 }]} />,
		second,
	);
	try {
		await settled(second);
		expect(second.querySelector("[data-skeleton]")).toBeNull();
	} finally {
		dispose();
		second.remove();
	}
});
