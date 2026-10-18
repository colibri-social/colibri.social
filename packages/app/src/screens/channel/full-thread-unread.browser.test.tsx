import { expect, it } from "vitest";
import { skeyOf } from "../../data/ids";
import { HQ, mount, springCard, until, wait } from "./desktop-test-kit";

const cardButton = (card: HTMLElement) =>
	(card.matches("button") ? card : card.querySelector("button")) ?? card;

it("keeps the channel unread while a thread fills the screen", async () => {
	const { store, source } = await mount();
	const space = source.world.spaces.find((entry) => entry.did === HQ);
	const dev = space?.channels.find(
		(entry) => skeyOf(entry.view.space) === "dev",
	);
	const author = space?.members.find(
		(member) => member.actor.did !== source.world.viewerDid,
	)?.actor.did;
	const community = store.spaceByKey(HQ);
	if (!dev || !author || !community) throw new Error("Seed changed");
	const unread = () => store.space(community).unread("dev");
	await until(() => !unread().hasUnread);

	cardButton(await springCard()).dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			shiftKey: true,
		}),
	);
	await until(() => !!document.querySelector("[data-thread-full]"));
	await wait(300);

	source.simulateMessage({
		author,
		channel: dev.view.space,
		text: "Channel news behind the full thread",
	});
	await wait(600);
	expect(unread().hasUnread).toBe(true);
});
