import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import "../../../app.css";
import type { LinkEmbed } from "../../../data/types";
import { MessageAttachments } from "./MessageAttachments";

const GIF =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const split = { media: [], audio: [], files: [] };

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
});

const mount = (embeds: LinkEmbed[]) => {
	host = document.createElement("div");
	document.body.append(host);
	stop = render(
		() => <MessageAttachments split={split} embeds={embeds} />,
		host,
	);
	return host;
};

it("renders a Tenor link as a bare GIF tile", () => {
	const root = mount([
		{
			uri: "https://tenor.com/view/touhou-fumo-plushie-plush-hello-gif-21004226",
			siteName: "Tenor",
			title: "Touhou Fumo GIF",
			image: { url: GIF, width: 438, height: 498 },
		} as LinkEmbed,
	]);

	const tile = root.querySelector<HTMLElement>(
		"[data-inline-media] [data-media-tile]",
	);
	expect(tile).toBeTruthy();
	expect(tile?.textContent).toContain("GIF");
	expect(root.querySelector("[data-link-embed]")).toBeNull();
});

it("keeps an ordinary page link as a card", () => {
	const root = mount([
		{
			uri: "https://atproto.com/guides/overview",
			siteName: "AT Protocol",
			title: "Protocol overview",
			image: { url: GIF, width: 1200, height: 630 },
		} as LinkEmbed,
	]);

	expect(root.querySelector("[data-link-embed]")).toBeTruthy();
	expect(root.querySelector("[data-inline-media]")).toBeNull();
});
