import { afterEach, expect, it } from "vitest";
import { skeyOf } from "../../data/ids";
import {
	cleanupMounted,
	HQ,
	main,
	mount,
	springCard,
	until,
	wait,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
});

const cardButton = (card: HTMLElement) =>
	(card.matches("button") ? card : card.querySelector("button")) ?? card;

const divider = () =>
	main().querySelector<HTMLElement>("[data-new-messages]") ?? undefined;

const openFullThread = async () => {
	cardButton(await springCard()).dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			shiftKey: true,
		}),
	);
	await until(() => !!document.querySelector("[data-thread-full]"));
	await wait(300);
};

const closeFullThread = async () => {
	const back = () =>
		document.querySelector<HTMLElement>(
			"[data-outlet='header'] button[aria-label='Back to #dev']",
		);
	await until(() => !!back());
	back()?.click();
	await until(() => !document.querySelector("[data-thread-full]"));
	await wait(300);
};

it("clears the unread marker after returning from a full-screen thread", async () => {
	await mount();
	await until(() => !!divider());
	await openFullThread();
	await closeFullThread();
	expect(divider()).toBeUndefined();
});

it("marks messages that arrived during a full-screen thread", async () => {
	const { source } = await mount();
	const space = source.world.spaces.find((entry) => entry.did === HQ);
	const dev = space?.channels.find(
		(entry) => skeyOf(entry.view.space) === "dev",
	);
	const author = space?.members.find(
		(member) => member.actor.did !== source.world.viewerDid,
	)?.actor.did;
	if (!dev || !author) throw new Error("Seed changed");
	await until(() => !!divider());
	await openFullThread();
	const arrived = source.simulateMessage({
		author,
		channel: dev.view.space,
		text: "Posted while the thread filled the screen",
	});
	await wait(300);
	await closeFullThread();
	await until(() => !!divider());
	const fresh = Array.from(main().querySelectorAll<HTMLElement>("*")).find(
		(element) =>
			element.childElementCount === 0 && element.textContent === arrived.text,
	);
	expect(fresh).toBeTruthy();
	const markerTop = divider()?.getBoundingClientRect().top ?? 0;
	const freshTop = fresh?.getBoundingClientRect().top ?? 0;
	expect(freshTop).toBeGreaterThan(markerTop);
	expect(freshTop - markerTop).toBeLessThan(200);
});

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
