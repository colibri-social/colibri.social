import { expect, it } from "vitest";
import type { SpaceRef } from "../../data/types";
import { HQ, main, mount, TEXT, until, wait } from "./desktop-test-kit";

const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;
const INVITE_URL = "https://colibri.social/invite/colibri-hq";
const INVITE_TEXT = `Come hang out ${INVITE_URL}`;

const scroller = () =>
	main().querySelector<HTMLElement>("[data-message-list-scroller]");

const list = () => main().querySelector<HTMLElement>("[data-message-list]");

const inviteCard = () =>
	main().querySelector<HTMLElement>('[data-invite-state="ready"]');

const mountWithInvite = async () => {
	const { store, source } = await mount();
	const feed = store.channel(DEV_REF);
	await until(() => feed.ready());
	const start = INVITE_TEXT.indexOf(INVITE_URL);
	await feed.send({
		text: INVITE_TEXT,
		facets: [
			{
				index: { byteStart: start, byteEnd: start + INVITE_URL.length },
				features: [
					{ $type: "social.colibri.beta.richtext.facet#link", uri: INVITE_URL },
				],
			},
		],
	});
	for (let index = 0; index < 20; index++) {
		await feed.send({ text: `Filler ${index}` });
	}
	await until(() => !!inviteCard());
	await wait(800);
	inviteCard()?.scrollIntoView({ block: "center" });
	await wait(500);
	const element = scroller() as HTMLElement;
	const node = list() as HTMLElement;
	const before = element.scrollTop;
	expect(before).toBeGreaterThan(0);
	expect(element.scrollHeight - element.clientHeight - before).toBeGreaterThan(
		200,
	);
	const invite = feed
		.messages()
		.find((message) => message.text === INVITE_TEXT);
	if (!invite) throw new Error("Invite message missing");
	return { store, source, feed, element, node, before, invite };
};

it("keeps the channel scroll position when a message with an invite link changes", async () => {
	const { feed, element, node, before, invite } = await mountWithInvite();
	await feed.react(invite.rkey, "👍", true);
	await wait(500);
	expect(scroller()).toBe(element);
	expect(list()).toBe(node);
	expect(element.scrollTop).toBe(before);
});

it("keeps the channel scroll position while the channel refreshes", async () => {
	const { store, element, node, before } = await mountWithInvite();
	store.catchUp();
	await wait(800);
	expect(scroller()).toBe(element);
	expect(list()).toBe(node);
	expect(element.scrollTop).toBe(before);
});
