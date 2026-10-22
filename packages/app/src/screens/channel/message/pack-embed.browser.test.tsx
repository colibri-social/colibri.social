import { clientOrigin } from "@colibri-social/lib";
import "../../../app.css";
import { emojiPackShareUrl } from "@colibri-social/ui";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { packTargetOf } from "../../../data/emoji/shared-pack";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import type { Did, Facet } from "../../../data/types";
import { listenForAppLinks } from "../../../native/deep-links";
import type { Route } from "../../../shell/layers";
import {
	articleWithText,
	cleanupMounted,
	main,
	mount as mountApp,
	until as untilApp,
	wait,
} from "../desktop-test-kit";
import { PackEmbed, packLinkOf } from "./pack-embed";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
};

let dispose: (() => void) | undefined;

afterEach(() => {
	cleanupMounted();
	dispose?.();
	dispose = undefined;
	document.body.innerHTML = "";
});

const mount = async (url: (packId: string) => string) => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	const catalog = await source.listEmoji(HQ);
	const pack = catalog.packs[0];
	if (!pack) throw new Error("HQ needs an emoji pack");
	const host = document.createElement("div");
	host.style.cssText = "width:416px";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<PackEmbed url={url(pack.id)} platform="desktop" />
			</DataContext.Provider>
		),
		host,
	);
	return { host, pack };
};

it("normalizes share links from every Colibri host", () => {
	const url = "https://next.colibri.social/emoji/did%3Aplc%3Aabc/3kowls";
	expect(packLinkOf(url)).toBe(`${clientOrigin()}/emoji/did:plc:abc/3kowls`);
	expect(packLinkOf("https://moji.blue/packs/did:plc:abc/3kowls")).toBe(
		`${clientOrigin()}/emoji/did:plc:abc/3kowls`,
	);
	expect(packLinkOf("https://example.com/emoji/did:plc:abc/3kowls")).toBe(
		undefined,
	);
});

it("loads a shared pack and follows it", async () => {
	const { host, pack } = await mount((id) =>
		emojiPackShareUrl(packTargetOf(id)),
	);
	await until(() => !!host.querySelector("[data-emoji-pack-card]"));
	const card = host.querySelector<HTMLElement>("[data-emoji-pack-card]");
	expect(card?.getAttribute("aria-label")).toBe(`Emoji pack ${pack.name}`);
	expect(card?.textContent).toContain(`${pack.emojis.length} emoji`);
	const follow = [...host.querySelectorAll("button")].find(
		(button) => button.textContent === "Follow pack",
	);
	expect(follow).toBeTruthy();
	follow?.click();
	await until(() =>
		[...host.querySelectorAll("button")].some(
			(button) => button.textContent === "Unfollow pack",
		),
	);
});

it("shows the unavailable card for a pack that doesn't exist", async () => {
	const { host } = await mount(() =>
		emojiPackShareUrl({ did: HQ, rkey: "3knotapack" }),
	);
	await until(() => !!host.querySelector("[data-emoji-pack-card-unavailable]"));
	expect(
		host
			.querySelector("[data-emoji-pack-card-unavailable]")
			?.getAttribute("data-emoji-pack-card-unavailable"),
	).toBe("missing");
});

it("lists every emoji in the pack when its name is clicked", async () => {
	const routes: Route[] = [];
	const stopListening = listenForAppLinks((route) => routes.push(route));
	const { host, pack } = await mount((id) =>
		emojiPackShareUrl(packTargetOf(id)),
	);
	await until(() => !!host.querySelector("[data-emoji-pack-card]"));
	const link = host.querySelector<HTMLAnchorElement>("[data-emoji-pack-title]");
	expect(link?.textContent).toBe(pack.name);
	const event = new MouseEvent("click", { bubbles: true, cancelable: true });
	link?.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
	await until(() => !!document.querySelector("[data-emoji-pack-view-all]"));
	stopListening();
	expect(routes).toHaveLength(0);
	const list = document.querySelector("[data-emoji-pack-view-all]");
	expect(list?.getAttribute("data-platform")).toBe("desktop");
	expect(list?.querySelectorAll("li")).toHaveLength(pack.emojis.length);
});

const linkFacet = (text: string, uri: string): Facet => {
	const start = text.indexOf(uri);
	return {
		index: { byteStart: start, byteEnd: start + uri.length },
		features: [
			{
				$type: "social.colibri.beta.richtext.facet#link",
				uri: uri as `${string}:${string}`,
			},
		],
	};
};

it("renders a moji.blue pack link as one pack card without a link preview", async () => {
	const { store, source } = await mountApp();
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("hq missing");
	const dev = store.space(hq).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	const feed = store.channel(dev.space);
	const pack = (await source.listEmoji(HQ)).packs[0];
	if (!pack) throw new Error("HQ needs an emoji pack");
	const target = packTargetOf(pack.id);
	const mojiBlue = `https://moji.blue/packs/${target.did}/${target.rkey}`;
	const share = emojiPackShareUrl(target);
	const text = `Moji pack ${mojiBlue} and ${share}`;
	const other = feed
		.messages()
		.find((entry) => entry.author.did !== store.viewer.did)?.author.did;
	if (!other) throw new Error("no other author");
	const created = source.simulateMessage({
		author: other,
		channel: feed.channel,
		text,
		facets: [linkFacet(text, mojiBlue), linkFacet(text, share)],
	});
	source.emit({
		$type: "messageEvent",
		event: "update",
		channel: feed.channel,
		message: {
			...created,
			embeds: [
				{
					uri: mojiBlue,
					title: "moji.blue",
					description: "An emoji pack on moji.blue.",
				},
			],
		} as typeof created,
	});
	await untilApp(
		() =>
			!!articleWithText(main(), "Moji pack")?.querySelector(
				"[data-emoji-pack-card]",
			),
	);
	await wait(100);
	const row = articleWithText(main(), "Moji pack") as HTMLElement;
	expect(row.querySelectorAll("[data-pack-embed]")).toHaveLength(1);
	expect(row.querySelector("[data-link-embed]")).toBeNull();
	expect(row.textContent).not.toContain("An emoji pack on moji.blue.");
});
