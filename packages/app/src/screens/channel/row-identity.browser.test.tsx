import { afterEach, expect, it } from "vitest";
import { setLatency } from "../../data/mock/source";
import { cleanupMounted, main, mount, until, wait } from "./desktop-test-kit";

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

const bodies = () =>
	new Map(
		Array.from(
			main().querySelectorAll<HTMLElement>("article[data-message-key]"),
		).map((article) => [
			article.dataset.messageKey as string,
			Array.from(article.querySelectorAll("*")).filter(
				(node) => !node.closest("[data-facet-type='codeblock']"),
			),
		]),
	);

it("keeps every rendered row in place when a refetch returns the same messages", async () => {
	const { store, source } = await mount();
	const listMessages = source.listMessages;
	source.listMessages = async (params) =>
		structuredClone(await listMessages(params));
	const feed = devFeed(store);
	await wait(1000);
	const before = feed.messages();
	const rendered = bodies();
	expect(rendered.size).toBeGreaterThan(3);

	store.catchUp();
	await until(() =>
		feed.messages().some((message, index) => message !== before[index]),
	);
	await wait(300);

	const after = bodies();
	for (const [key, nodes] of rendered) {
		if (!after.has(key)) continue;
		const detached = nodes.filter((node) => !node.isConnected);
		expect(detached).toEqual([]);
	}
});
