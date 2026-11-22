import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it } from "vitest";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(
		() =>
			(host?.querySelectorAll('[data-pane-index="1"] [data-message]').length ??
				0) > 3,
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	if (!community) throw new Error("hq missing");
	const dev = store.space(community).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	const feed = store.channel(dev.space);
	await until(() => feed.ready());
	return { store, feed, root: host };
};

const pane = (root: HTMLElement) =>
	root.querySelector('[data-pane-index="1"]') as HTMLElement;

const rowWithText = (root: HTMLElement, text: string) =>
	Array.from(pane(root).querySelectorAll<HTMLElement>("article")).find(
		(article) =>
			article.querySelector("[data-message-body], [data-rich-text]")
				?.textContent === text ||
			Array.from(article.querySelectorAll("p")).some(
				(paragraph) => paragraph.textContent === text,
			),
	);

it("jumps from a reply to a reply to its parent", async () => {
	const { feed, root, store } = await mount();
	const original = feed.messages().at(-1);
	if (!original) throw new Error("no messages");
	await feed.send({ text: "First reply", parent: original.rkey });
	const first = feed
		.messages()
		.find(
			(message) =>
				message.text === "First reply" &&
				message.author.did === store.viewer.did,
		);
	if (!first) throw new Error("first reply missing");
	await feed.send({ text: "Second reply", parent: first.rkey });
	await until(() => !!rowWithText(root, "Second reply"));
	const second = rowWithText(root, "Second reply") as HTMLElement;
	const preview = second.querySelector<HTMLButtonElement>(
		"[data-message-reply] button",
	);
	expect(preview?.disabled).toBe(false);
	preview?.click();
	await until(
		() =>
			rowWithText(root, "First reply")?.getAttribute("data-highlight") ===
			"jumped",
	);
	expect(document.body.textContent).not.toContain("That message is not loaded");
});
