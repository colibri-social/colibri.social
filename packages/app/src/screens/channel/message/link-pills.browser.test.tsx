import "../../../app.css";
import { afterEach, expect, it } from "vitest";
import { channelSlug } from "../../../data/ids";
import type { Facet } from "../../../data/types";
import {
	articleWithText,
	cleanupMounted,
	HQ,
	main,
	mount,
	TEXT,
	until,
} from "../desktop-test-kit";

afterEach(cleanupMounted);

const linkFacet = (text: string, uri: string): Facet => {
	const start = new TextEncoder().encode(
		text.slice(0, text.indexOf(uri)),
	).length;
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

it("renders links into other Spaces as pills and locks the ones it can't open", async () => {
	const { store, source } = await mount();
	const other = store.communities.value()?.find((entry) => entry.did !== HQ);
	if (!other) throw new Error("needs a second joined space");
	const otherSpace = store.space(other);
	await until(() => otherSpace.channels.value() !== undefined);
	const target = otherSpace.channels
		.value()
		?.find((entry) => entry.viewer.canRead);
	if (!target) throw new Error("needs a readable channel");
	const slug = channelSlug(target);
	const origin = location.origin;
	const message = `${origin}/app/c/${other.did}/${TEXT}/${slug}/m/3kmsg`;
	const missing = `${origin}/app/c/${other.did}/${TEXT}/3kmissing/m/3kmsg`;
	const stranger = `${origin}/app/c/did:plc:stranger/${TEXT}/general/m/3kmsg`;
	const text = `Pills ${message} ${missing} ${stranger}`;

	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("hq missing");
	const dev = store.space(hq).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	const feed = store.channel(dev.space);
	const author = feed
		.messages()
		.find((entry) => entry.author.did !== store.viewer.did)?.author.did;
	if (!author) throw new Error("no other author");
	source.simulateMessage({
		author,
		channel: feed.channel,
		text,
		facets: [
			linkFacet(text, message),
			linkFacet(text, missing),
			linkFacet(text, stranger),
		],
	});

	await until(
		() =>
			(articleWithText(main(), "Pills")?.querySelectorAll(
				"[data-facet-type='message']",
			).length ?? 0) === 3,
	);
	const row = articleWithText(main(), "Pills") as HTMLElement;
	const [ready, unreadable, unjoined] = Array.from(
		row.querySelectorAll<HTMLElement>("[data-facet-type='message']"),
	);
	expect(ready?.getAttribute("data-space")).toBe(other.did);
	expect(ready?.hasAttribute("data-locked")).toBe(false);
	expect(ready?.textContent).toContain(`#${target.name}`);
	expect(ready?.getAttribute("href")).toBe(message);
	expect(unreadable?.hasAttribute("data-locked")).toBe(true);
	expect(unreadable?.textContent).toBe("No access");
	expect(unjoined?.hasAttribute("data-locked")).toBe(true);
	expect(unjoined?.textContent).toBe("No access");
});
