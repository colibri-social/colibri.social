import { emojiPackShareUrl } from "@colibri-social/ui";
import { expect, it } from "vitest";
import { packTargetOf } from "../../data/emoji/shared-pack";
import type { Did, SpaceRef } from "../../data/types";
import {
	articleWithText,
	HQ,
	main,
	mount,
	TEXT,
	until,
	wait,
} from "./desktop-test-kit";

const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;
const OWLS = "did:plc:nightowlsartclub3e5f7g9h" as Did;

const scroller = () =>
	main().querySelector<HTMLElement>("[data-message-list-scroller]");

const list = () => main().querySelector<HTMLElement>("[data-message-list]");

const linkFacet = (text: string, url: string) => {
	const start = new TextEncoder().encode(
		text.slice(0, text.indexOf(url)),
	).length;
	return {
		index: {
			byteStart: start,
			byteEnd: start + new TextEncoder().encode(url).length,
		},
		features: [{ $type: "social.colibri.beta.richtext.facet#link", uri: url }],
	};
};

it("keeps the channel scroll position when a visible message gains a pack link from an unknown owner", async () => {
	const { store, source } = await mount();
	const pack = (await source.listEmoji(OWLS)).packs[0];
	if (!pack) throw new Error("The owls Space needs an emoji pack");
	store.communities.update((views) =>
		views.filter((view) => view.did !== OWLS),
	);
	const feed = store.channel(DEV_REF);
	await until(() => feed.ready());
	for (let index = 0; index < 24; index++) {
		await feed.send({ text: `Filler ${index}` });
	}
	const filler = () => articleWithText(main(), "Filler 2");
	await until(() => !!filler());
	await wait(800);
	filler()?.scrollIntoView({ block: "center" });
	await wait(500);
	const element = scroller() as HTMLElement;
	const node = list() as HTMLElement;
	const before = element.scrollTop;
	expect(before).toBeGreaterThan(0);
	expect(element.scrollHeight - element.clientHeight - before).toBeGreaterThan(
		200,
	);
	const target = feed.messages().find((entry) => entry.text === "Filler 2");
	if (!target?.rkey) throw new Error("Filler message missing");
	const url = emojiPackShareUrl(packTargetOf(pack.id));
	const text = `Filler 2 ${url}`;
	await feed.edit(target.rkey, text, [linkFacet(text, url)] as never);
	await until(() => !!main().querySelector("[data-pack-embed]"));
	await wait(800);
	expect(scroller()).toBe(element);
	expect(list()).toBe(node);
	expect(element.scrollTop).toBe(before);
});
