import type { MediaItem } from "@colibri-social/ui";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import "../../../app.css";
import {
	MediaLinkContext,
	type MediaLinkRefresher,
} from "../../../data/media-link";
import { MessageAttachments } from "./MessageAttachments";

const GIF =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const BROKEN = "data:image/png;base64,AAAA";

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
});

const image = (src: string): MediaItem => ({
	src,
	kind: "image",
	width: 400,
	height: 300,
	name: "photo.png",
});

const mount = (refresher: MediaLinkRefresher, initial: MediaItem) => {
	const [media, setMedia] = createSignal<MediaItem[]>([initial]);
	host = document.createElement("div");
	document.body.append(host);
	stop = render(
		() => (
			<MediaLinkContext.Provider value={refresher}>
				<MessageAttachments
					split={{ media: media(), audio: [], files: [] }}
					embeds={[]}
				/>
			</MediaLinkContext.Provider>
		),
		host,
	);
	return { root: host, setMedia };
};

const tileOf = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-media-tile]");

it("refreshes a failed link and shows the fresh image", async () => {
	let swap: ((items: MediaItem[]) => void) | undefined;
	const refresh = vi.fn(async () => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		swap?.([image(GIF)]);
		return true;
	});
	const { root, setMedia } = mount({ refresh, retry: vi.fn() }, image(BROKEN));
	swap = setMedia;
	await vi.waitFor(() => expect(refresh).toHaveBeenCalledWith(BROKEN));
	await vi.waitFor(() =>
		expect(tileOf(root)?.querySelector("img")?.getAttribute("src")).toBe(GIF),
	);
	await vi.waitFor(() =>
		expect(tileOf(root)?.getAttribute("data-media-status")).toBe("ok"),
	);
	expect(root.querySelector("[data-media-error]")).toBeNull();
	expect(refresh).toHaveBeenCalledTimes(1);
});

it("shows the error state when the refresh brings nothing new, and retries", async () => {
	const refresh = vi.fn(async () => false);
	const retry = vi.fn();
	const { root } = mount({ refresh, retry }, image(BROKEN));
	await vi.waitFor(() =>
		expect(tileOf(root)?.getAttribute("data-media-status")).toBe("broken"),
	);
	const error = root.querySelector<HTMLElement>("[data-media-error]");
	expect(error?.textContent).toContain("Couldn't load this image");
	expect(root.querySelector("[data-media-tile] img")).toBeNull();
	const button = error?.querySelector<HTMLButtonElement>("button");
	expect(button?.textContent).toBe("Try again");
	button?.click();
	expect(retry).toHaveBeenCalledWith(BROKEN);
	await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
	await vi.waitFor(() =>
		expect(tileOf(root)?.getAttribute("data-media-status")).toBe("broken"),
	);
});
