import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import type { BlueskyClientID } from "../../../data/bluesky-client";
import { DataContext, type DataStore } from "../../../data/store";
import type { BlueskyPostView, Datetime, Did } from "../../../data/types";
import { BlueskyEmbed, MessageAttachments } from "./MessageAttachments";

const text =
	"Spaces are here \u{1F440} with @lou.gg, notes at github.com/colibri-soci... #colibri";
const bytes = (value: string) => new TextEncoder().encode(value).length;
const span = (needle: string) => {
	const byteStart = bytes(text.slice(0, text.indexOf(needle)));
	return { byteStart, byteEnd: byteStart + bytes(needle) };
};

const view: BlueskyPostView = {
	url: "https://bsky.app/profile/colibri.social/post/3myaqwvksck2w",
	author: {
		did: "did:plc:colibri" as Did,
		handle: "colibri.social",
		displayName: "Colibri Social",
	},
	text,
	facets: [
		{
			index: span("@lou.gg"),
			features: [
				{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:lou" },
			],
		},
		{
			index: span("github.com/colibri-soci..."),
			features: [
				{
					$type: "app.bsky.richtext.facet#link",
					uri: "https://github.com/colibri-social/colibri.social/releases",
				},
			],
		},
		{
			index: span("#colibri"),
			features: [{ $type: "app.bsky.richtext.facet#tag", tag: "colibri" }],
		},
	],
	createdAt: "2026-10-19T18:31:42.392Z" as Datetime,
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
});

const mount = (
	blueskyClient: BlueskyClientID,
	customBlueskyClientBase: string,
	content: () => ReturnType<typeof BlueskyEmbed>,
) => {
	const store = {
		preferences: {
			client: () => ({ blueskyClient, customBlueskyClientBase }),
		},
	} as unknown as DataStore;
	host = document.createElement("div");
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>{content()}</DataContext.Provider>
		),
		host,
	);
	return host;
};

const linkNamed = async (root: HTMLElement, name: string) => {
	let found: HTMLAnchorElement | undefined;
	await vi.waitFor(
		() => {
			found = [...root.querySelectorAll("a")].find(
				(anchor) =>
					anchor.getAttribute("aria-label") === name ||
					anchor.textContent === name,
			);
			expect(found).toBeDefined();
		},
		{ timeout: 3000 },
	);
	return found as HTMLAnchorElement;
};

it("shows the Mu Social logo and opens facets on Mu Social", async () => {
	const load = vi.fn(async () => view);
	const root = mount("mu", "", () => (
		<BlueskyEmbed url={view.url} load={load} />
	));

	const open = await linkNamed(root, "Open on Mu Social");
	expect(open.href).toBe(
		"https://mu.social/profile/colibri.social/post/3myaqwvksck2w",
	);
	expect(
		open
			.querySelector("[data-bluesky-client]")
			?.getAttribute("data-bluesky-client"),
	).toBe("mu");
	expect(root.querySelector('[aria-label="Open on Bluesky"]')).toBeNull();
	expect((await linkNamed(root, "@lou.gg")).href).toBe(
		"https://mu.social/profile/did:plc:lou",
	);
	expect((await linkNamed(root, "github.com/colibri-soci...")).href).toBe(
		"https://github.com/colibri-social/colibri.social/releases",
	);
	expect((await linkNamed(root, "#colibri")).href).toBe(
		"https://mu.social/search?q=%23colibri",
	);
	expect(root.querySelector("article")?.getAttribute("aria-label")).toBe(
		"Post by Colibri Social",
	);
});

it("shows an arrow for a custom client and loads its post links", async () => {
	const custom =
		"https://sky.example.org/profile/colibri.social/post/3myaqwvksck2w";
	const load = vi.fn(async () => view);
	const root = mount("custom", "sky.example.org", () => (
		<MessageAttachments
			split={{ media: [], audio: [], files: [] }}
			embeds={[]}
			blueskyLinks={[custom]}
			blueskyHost="sky.example.org"
			loadBlueskyPost={load}
		/>
	));

	const open = await linkNamed(root, "Open on sky.example.org");
	expect(load).toHaveBeenCalledWith(
		"https://bsky.app/profile/colibri.social/post/3myaqwvksck2w",
	);
	expect(open.href).toBe(custom);
	expect(open.querySelector("[data-bluesky-client]")).toBeNull();
	expect(open.querySelector("svg")).not.toBeNull();
	expect((await linkNamed(root, "#colibri")).href).toBe(
		"https://sky.example.org/search?q=%23colibri",
	);
});
