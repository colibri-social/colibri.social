import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import type { LiveEvent } from "./source";
import { createDataStore } from "./store";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async () => {
	setLatency(0);
	const base = createMockSource({ live: false });
	const listeners = new Set<(event: LiveEvent) => void>();
	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};
	const source = {
		...base,
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);
			const stop = base.subscribe(listener);
			return () => {
				listeners.delete(listener);
				stop();
			};
		},
	};
	const store = createDataStore(source);
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
		ReturnType<typeof store.communities.value>
	>[number];
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	const channels = space.channels.value() ?? [];
	for (const entry of channels) {
		if (entry.type !== "social.colibri.beta.channel.text") continue;
		const feed = store.channel(entry.space);
		await until(() => feed.ready());
		if (feed.hasOlder()) return { store, feed, emit };
	}
	throw new Error("no channel with older history");
};

describe("history arriving live", () => {
	it("leaves a message older than the loaded window for paging", async () => {
		const { feed, emit } = await setup();
		const loaded = feed.messages();
		const oldest = loaded[0];
		if (!oldest) throw new Error("empty feed");
		const imported = {
			...oldest,
			rkey: "2222222222222",
			uri: oldest.uri.replace(oldest.rkey, "2222222222222"),
			text: "Imported from long ago",
		};
		emit({
			$type: "messageEvent",
			event: "create",
			channel: feed.channel,
			message: imported as typeof oldest,
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(feed.messages()).toBe(loaded);

		feed.loadOlder();
		await until(() => !feed.loadingOlder() && feed.messages() !== loaded);
		const rkeys = feed.messages().map((message) => message.rkey);
		expect(new Set(rkeys).size).toBe(rkeys.length);
	});

	it("places a message inside the loaded window", async () => {
		const { feed, emit } = await setup();
		const loaded = feed.messages();
		const [first, second] = loaded;
		if (!first || !second) throw new Error("feed too short");
		const between = `${first.rkey}a`;
		emit({
			$type: "messageEvent",
			event: "create",
			channel: feed.channel,
			message: {
				...first,
				rkey: between,
				uri: first.uri.replace(first.rkey, between),
				text: "Imported between two messages",
			} as typeof first,
		});
		await until(() => feed.messages() !== loaded);
		expect(feed.messages()[1]?.rkey).toBe(between);
		expect(feed.messages()[0]).toBe(first);
	});
});
