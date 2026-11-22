import { afterEach, expect, it } from "vitest";
import { setLatency } from "../../data/mock/source";
import {
	articleWithText,
	cleanupMounted,
	main,
	mount,
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

it("drops link embeds for links that open inside the app", async () => {
	const { store, source } = await mount();
	const feed = devFeed(store);
	const other = feed
		.messages()
		.find((entry) => entry.author.did !== store.viewer.did)?.author.did;
	if (!other) throw new Error("no other author");
	const created = source.simulateMessage({
		author: other,
		channel: feed.channel,
		text: "Two links",
	});
	source.emit({
		$type: "messageEvent",
		event: "update",
		channel: feed.channel,
		message: {
			...created,
			embeds: [
				{
					uri: "https://colibri.social/app/c/did:plc:colibrihqspace2a4b6c8d/social.colibri.beta.channel.text/dev",
					title: "Colibri",
					description: "The app itself.",
				},
				{
					uri: "https://example.com/article",
					title: "An article",
					description: "Something to read.",
				},
			],
		} as typeof created,
	});
	await until(
		() =>
			!!articleWithText(main(), "Two links")?.querySelector(
				"[data-link-embed]",
			),
	);
	await wait(100);
	const row = articleWithText(main(), "Two links") as HTMLElement;
	const cards = [...row.querySelectorAll("[data-link-embed]")];
	expect(cards).toHaveLength(1);
	expect(cards[0]?.textContent).toContain("An article");
	expect(row.textContent).not.toContain("The app itself.");
});
