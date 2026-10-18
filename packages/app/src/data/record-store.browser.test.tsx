import { createEffect, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { createRecordStore } from "./record-store";
import type { LiveEvent } from "./source";
import { createDataStore } from "./store";
import type { Facet, MessageView, SpaceRef } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

describe("record store", () => {
	it("replaces the whole value on put, so missing keys are dropped", () => {
		createRoot((dispose) => {
			const records = createRecordStore<{ a: number; b?: number }>();
			records.put("one", { a: 1, b: 2 });
			records.put("one", { a: 3 });
			expect(records.get("one")).toEqual({ a: 3 });
			expect("b" in (records.get("one") ?? {})).toBe(false);
			dispose();
		});
	});

	it("removes a key and notifies readers", () => {
		const seen: (number | undefined)[] = [];
		const { records, dispose } = createRoot((dispose) => {
			const records = createRecordStore<{ a: number }>({ one: { a: 1 } });
			createEffect(() => seen.push(records.state.one?.a));
			return { records, dispose };
		});
		records.remove("one");
		expect(records.get("one")).toBeUndefined();
		expect(Object.keys(records.state)).toEqual([]);
		expect(seen).toEqual([1, undefined]);
		dispose();
	});

	it("keeps unchanged fields stable for fine-grained readers", () => {
		let runs = 0;
		const { records, dispose } = createRoot((dispose) => {
			const records = createRecordStore<{ a: number; b: number }>();
			records.put("one", { a: 1, b: 1 });
			createEffect(() => {
				records.state.one?.a;
				runs += 1;
			});
			return { records, dispose };
		});
		records.put("one", { a: 1, b: 2 });
		expect(records.get("one")).toEqual({ a: 1, b: 2 });
		expect(runs).toBe(1);
		dispose();
	});
});

describe("channel summary writes", () => {
	it("drops the emoji facets once a plain message follows", async () => {
		setLatency(0);
		const base = createMockSource({ live: false });
		const listeners = new Set<(event: LiveEvent) => void>();
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
			?.find((entry) => entry.handle.startsWith("hq."));
		if (!hq) throw new Error("hq missing");
		const space = store.space(hq);
		await until(() => !!space.channels.value());
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const ref = general.space as SpaceRef;
		await until(() => !!store.lastMessage(ref));
		const emit = (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		};
		const message = (rkey: string, overrides: Partial<MessageView>) =>
			({
				uri: `at://did:plc:a/social.colibri.beta.channel.message/${rkey}`,
				rkey,
				channel: ref,
				author: { did: "did:plc:someone", handle: "someone.test" },
				text: "",
				createdAt: new Date().toISOString(),
				attachments: [],
				reactions: [],
				labels: [],
				...overrides,
			}) as MessageView;
		const emoji: Facet = {
			index: { byteStart: 0, byteEnd: 5 },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#customEmoji",
					uri: "at://did:plc:hq/blue.moji.collection.item/kek",
				},
			] as Facet["features"],
		};
		emit({
			$type: "messageEvent",
			event: "create",
			channel: ref,
			message: message("zzzz1", {
				text: ":kek:",
				facets: [emoji],
				attachments: [
					{ url: "https://x/a.png", mimeType: "image/png" },
				] as never,
			}),
		});
		expect(store.lastMessage(ref)?.facets).toHaveLength(1);
		expect(store.lastMessage(ref)?.attachment).toBe("image");
		emit({
			$type: "messageEvent",
			event: "create",
			channel: ref,
			message: message("zzzz2", { text: "plain words" }),
		});
		const summary = store.lastMessage(ref);
		expect(summary?.text).toBe("plain words");
		expect(summary && "facets" in summary).toBe(false);
		expect(summary && "attachment" in summary).toBe(false);
		store.dispose();
	});
});
