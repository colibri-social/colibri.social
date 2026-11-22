import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { setLatency } from "../../data/mock/source";
import {
	articleWithText,
	cleanupMounted,
	main,
	menuItem,
	mount,
	rightClick,
	until,
	wait,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
	setLatency(0);
});

const devFeed = (store: Awaited<ReturnType<typeof mount>>["store"]) => {
	const hq = store.communities
		.value()
		?.find((entry) => entry.did === "did:plc:colibrihqspace2a4b6c8d");
	if (!hq) throw new Error("hq missing");
	const dev = store.space(hq).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	return store.channel(dev.space);
};

const imageFile = async () => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 48;
	const context = canvas.getContext("2d");
	if (context) {
		context.fillStyle = "#3a7";
		context.fillRect(0, 0, 64, 48);
	}
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(value) => (value ? resolve(value) : reject(new Error("no blob"))),
			"image/png",
		),
	);
	return new File([blob], "square.png", { type: "image/png" });
};

const lightbox = () => document.querySelector<HTMLElement>("[data-lightbox]");

it("keeps the lightbox open while a pending image message settles", async () => {
	const { store } = await mount();
	const feed = devFeed(store);
	setLatency(600);
	const file = await imageFile();
	const sent = feed.send({
		text: "Pending picture",
		files: [{ file, previewSrc: URL.createObjectURL(file) }],
	});
	await until(() => !!articleWithText(main(), "Pending picture"));
	const row = articleWithText(main(), "Pending picture") as HTMLElement;
	expect(row.dataset.state).toBe("pending");
	await until(() => !!row.querySelector("[data-media-tile] button"));
	row.querySelector<HTMLButtonElement>("[data-media-tile] button")?.click();
	await until(() => !!lightbox());
	const opened = lightbox();
	await sent;
	await until(
		() => articleWithText(main(), "Pending picture")?.dataset.state === "sent",
	);
	await wait(300);
	expect(lightbox()).toBe(opened);
	expect(lightbox()?.isConnected).toBe(true);
});

const menuLabels = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']")).map(
		(item) => item.textContent?.trim(),
	);

it("offers copy and delete on a pending message and deleting cancels the send", async () => {
	const { store, source } = await mount();
	const feed = devFeed(store);
	source.setSimulation({ offline: true });
	void feed.send({ text: "Still sending" });
	await until(() => !!articleWithText(main(), "Still sending"));
	const row = articleWithText(main(), "Still sending") as HTMLElement;
	expect(row.dataset.state).toBe("pending");
	rightClick(row);
	await until(() => !!menuItem("Delete message"));
	const labels = menuLabels();
	expect(labels).toContain("Copy text");
	expect(labels).not.toContain("Reply");
	expect(labels).not.toContain("Edit message");
	expect(labels).not.toContain("Forward");
	await userEvent.click(menuItem("Delete message") as HTMLElement);
	await until(() => !articleWithText(main(), "Still sending"));
	expect(feed.pending()).toHaveLength(0);
	source.setSimulation({ offline: false });
	await wait(600);
	expect(articleWithText(main(), "Still sending")).toBeUndefined();
	const ref = feed.channel;
	const listed = await source.listMessages({ channel: ref });
	expect(listed.items.some((entry) => entry.text === "Still sending")).toBe(
		false,
	);
});

it("deletes a send that was already in flight once it lands", async () => {
	const { store, source } = await mount();
	const feed = devFeed(store);
	setLatency(800);
	void feed.send({ text: "Already on its way" });
	await until(() => !!articleWithText(main(), "Already on its way"));
	await wait(100);
	rightClick(articleWithText(main(), "Already on its way") as HTMLElement);
	await until(() => !!menuItem("Delete message"));
	await userEvent.click(menuItem("Delete message") as HTMLElement);
	await until(() => !articleWithText(main(), "Already on its way"));
	const seen: boolean[] = [];
	const started = performance.now();
	while (performance.now() - started < 2500) {
		seen.push(!!articleWithText(main(), "Already on its way"));
		await wait(50);
	}
	expect(seen.some(Boolean)).toBe(false);
	setLatency(0);
	const listed = await source.listMessages({ channel: feed.channel });
	expect(
		listed.items.some((entry) => entry.text === "Already on its way"),
	).toBe(false);
});

it("keeps a discarded send hidden when a refresh brings it back", async () => {
	const { store, source } = await mount();
	const feed = devFeed(store);
	setLatency(400);
	void feed.send({ text: "Refresh should not revive" });
	await until(() => !!articleWithText(main(), "Refresh should not revive"));
	rightClick(
		articleWithText(main(), "Refresh should not revive") as HTMLElement,
	);
	await until(() => !!menuItem("Delete message"));
	await userEvent.click(menuItem("Delete message") as HTMLElement);
	source.setSimulation({ offline: true });
	await until(() => !articleWithText(main(), "Refresh should not revive"));
	setLatency(0);
	await until(() =>
		source.world.spaces.some((space) =>
			space.channels.some((channel) =>
				channel.messages?.some(
					(message) => message.text === "Refresh should not revive",
				),
			),
		),
	);
	const revived: boolean[] = [];
	store.catchUp();
	const started = performance.now();
	while (performance.now() - started < 1200) {
		revived.push(!!articleWithText(main(), "Refresh should not revive"));
		await wait(30);
	}
	expect(revived.some(Boolean)).toBe(false);
	source.setSimulation({ offline: false });
	await until(
		() =>
			!source.world.spaces.some((space) =>
				space.channels.some((channel) =>
					channel.messages?.some(
						(message) => message.text === "Refresh should not revive",
					),
				),
			),
	);
	expect(articleWithText(main(), "Refresh should not revive")).toBeUndefined();
});

it("opens the reduced menu on a failed message", async () => {
	const { store } = await mount();
	const feed = devFeed(store);
	await feed.send({ text: "This will fail" });
	await until(
		() => articleWithText(main(), "This will fail")?.dataset.state === "failed",
	);
	rightClick(articleWithText(main(), "This will fail") as HTMLElement);
	await until(() => !!menuItem("Delete message"));
	expect(menuLabels()).toContain("Copy text");
	expect(menuLabels()).toContain("Retry");
	expect(menuLabels()).not.toContain("Reply");
});

it("highlights the message being replied to and jumps to it from the reply bar", async () => {
	await mount();
	const articles = main().querySelectorAll<HTMLElement>(
		"article[data-message-key]",
	);
	const key = articles[Math.max(0, articles.length - 10)]?.dataset.messageKey;
	if (!key) throw new Error("no message");
	const row = () =>
		main().querySelector<HTMLElement>(`article[data-message-key="${key}"]`);
	await until(() => !!row());
	row()?.scrollIntoView({ block: "center" });
	await wait(200);
	rightClick(row() as HTMLElement);
	await until(() => !!menuItem("Reply"));
	await userEvent.click(menuItem("Reply") as HTMLElement);
	await until(() => row()?.dataset.highlight === "replying");
	const scroller = main().querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;
	scroller.scrollTop = scroller.scrollHeight;
	await wait(300);
	const jump = main().querySelector<HTMLElement>(
		"[data-composer-bar='reply'] [data-composer-bar-action]",
	);
	await userEvent.click(jump as HTMLElement);
	await until(() => row()?.dataset.highlight === "jumped");
	const box = row()?.getBoundingClientRect();
	const view = scroller.getBoundingClientRect();
	expect(box && box.bottom > view.top && box.top < view.bottom).toBe(true);
	const cancel = main().querySelector<HTMLButtonElement>(
		"[data-composer-bar='reply'] button[aria-label='Cancel reply']",
	);
	await userEvent.click(cancel as HTMLElement);
	await until(() => !row()?.dataset.highlight);
});

it("keeps a link preview lightbox open when the message view is replaced", async () => {
	const { store, source } = await mount();
	const feed = devFeed(store);
	const other = feed
		.messages()
		.find((entry) => entry.author.did !== store.viewer.did)?.author.did;
	if (!other) throw new Error("no other author");
	const file = await imageFile();
	const image = URL.createObjectURL(file);
	const created = source.simulateMessage({
		author: other,
		channel: feed.channel,
		text: "Card with a picture",
	});
	const withEmbed = {
		...created,
		embeds: [
			{
				uri: "https://example.com/article",
				title: "An article",
				description: "Something to read.",
				image: { url: image, width: 64, height: 48 },
			},
		],
	} as typeof created;
	source.emit({
		$type: "messageEvent",
		event: "update",
		channel: feed.channel,
		message: withEmbed,
	});
	await until(
		() =>
			!!articleWithText(main(), "Card with a picture")?.querySelector(
				"[data-link-embed] [data-media-tile]",
			),
	);
	const row = articleWithText(main(), "Card with a picture") as HTMLElement;
	row
		.querySelector<HTMLElement>("[data-link-embed] [data-media-tile]")
		?.click();
	await until(() => !!lightbox());
	const opened = lightbox();
	source.emit({
		$type: "messageEvent",
		event: "update",
		channel: feed.channel,
		message: structuredClone(withEmbed),
	});
	await wait(300);
	expect(lightbox()).toBe(opened);
	expect(lightbox()?.isConnected).toBe(true);
});
