import { nextTid } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import type { LiveEvent } from "./source";
import { createDataStore } from "./store";
import type { Did, Facet, MessageView } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();

	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const emojiFacets = () => {
	return [
		{
			index: { byteStart: 0, byteEnd: 5 },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#customEmoji",
					uri: "at://did:plc:owner/social.colibri.beta.emoji/kek",
				},
			],
		},
	] as unknown as Facet[];
};

const mentionFacets = () => {
	return [
		{
			index: { byteStart: 0, byteEnd: 4 },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#mention",
					did: "did:plc:eli",
				},
			],
		},
	] as unknown as Facet[];
};

const linkFacets = () => {
	return [
		{
			index: { byteStart: 25, byteEnd: 55 },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#link",
					uri: "https://example.com/an-article",
				},
			],
		},
	] as unknown as Facet[];
};

const setup = async () => {
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

	const channel = store.channel(general.space);

	await until(() => channel.ready());

	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};

	return { store, channel, emit };
};

describe("channel summary facets", () => {
	it("keeps an earlier sent message's facets after a later send", async () => {
		const { store, channel } = await setup();

		await channel.send({ text: ":kek: this is a test", facets: emojiFacets() });
		await channel.send({
			text: "@Eli in Space second test",
			facets: mentionFacets(),
		});

		const first = channel
			.messages()
			.find((message) => message.text === ":kek: this is a test");

		expect(first?.facets).toEqual(emojiFacets());
		store.dispose();
	});

	it("keeps an earlier live message's facets after a later one arrives", async () => {
		const { store, channel, emit } = await setup();
		const template = channel.messages().at(-1);
		if (!template) throw new Error("no messages");

		const earlier = nextTid();
		const later = nextTid();
		const author = {
			...template.author,
			did: "did:plc:lou" as Did,
		};
		const incoming = (
			rkey: string,
			text: string,
			facets: Facet[],
		): MessageView => {
			return {
				...template,
				uri: `at://did:plc:lou/social.colibri.beta.message/${rkey}` as MessageView["uri"],
				rkey,
				author,
				text,
				facets,
				createdAt: new Date().toISOString() as MessageView["createdAt"],
				reactions: [],
				labels: [],
			};
		};

		emit({
			$type: "messageEvent",
			event: "create",
			channel: template.channel,
			message: incoming(
				earlier,
				"I'm pretty sure that's illegal :kek:",
				emojiFacets().map((facet) => ({
					...facet,
					index: { byteStart: 31, byteEnd: 36 },
				})),
			),
		});
		emit({
			$type: "messageEvent",
			event: "create",
			channel: template.channel,
			message: incoming(
				later,
				"For context, by the way: https://example.com/an-article",
				linkFacets(),
			),
		});

		await until(() =>
			channel.messages().some((message) => message.rkey === later),
		);

		const first = channel
			.messages()
			.find((message) => message.rkey === earlier);

		expect(first?.facets?.[0]?.features).toEqual(emojiFacets()[0]?.features);
		store.dispose();
	});
});
