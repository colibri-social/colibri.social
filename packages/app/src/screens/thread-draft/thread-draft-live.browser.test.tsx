import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { SpaceRef } from "../../data/types";
import {
	HQ,
	main,
	menuItem,
	mount,
	rightClick,
	send,
	TEXT,
	until,
	wait,
} from "../channel/desktop-test-kit";

const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;

const draftView = () =>
	document.querySelector<HTMLElement>(
		"[data-shell-thread] [data-thread-draft-view]",
	);

it("keeps the desktop draft pane open while messages arrive in the channel", async () => {
	const { source } = await mount();
	const author = source.world.spaces
		.find((entry) => entry.did === HQ)
		?.members.find((member) => member.actor.did !== source.world.viewerDid)
		?.actor.did;
	if (!author) throw new Error("Seed changed");
	const article = await send("Draft anchor");

	rightClick(article);
	await until(() => !!menuItem("Open thread"));
	await userEvent.click(menuItem("Open thread") as HTMLElement);
	await until(() => !!draftView());
	const view = draftView() as HTMLElement;
	const path = location.pathname;
	const input = view.querySelector("input") as HTMLInputElement;
	const anchorCard = view.querySelector("[data-thread-anchor]");
	const editor = view.querySelector<HTMLElement>('[contenteditable="true"]');
	await userEvent.type(input, "Release notes");
	await userEvent.click(editor as HTMLElement);
	await userEvent.keyboard("Half a thought");

	for (let index = 0; index < 3; index++) {
		source.simulateMessage({
			author,
			channel: DEV_REF,
			text: `Interruption ${index}`,
		});
		await wait(150);
	}
	await until(() => !!main().textContent?.includes("Interruption 2"));
	const space = source.world.spaces.find((entry) => entry.did === HQ);
	const channel = space?.channels.find((entry) => entry.view.space === DEV_REF);
	if (!space || !channel) throw new Error("Seed changed");
	source.emit({
		$type: "channelEvent",
		event: "update",
		community: space.did,
		channel: { ...channel.view },
	});
	source.emit({
		$type: "communityEvent",
		event: "update",
		community: { ...space.view },
	});
	await wait(400);

	expect(location.pathname).toBe(path);
	expect(draftView()).toBe(view);
	expect(view.querySelector("input")).toBe(input);
	expect(input.value).toBe("Release notes");
	expect(view.querySelector("[data-thread-anchor]")).toBe(anchorCard);
	expect(anchorCard?.textContent).toContain("Draft anchor");
	expect(view.querySelector('[contenteditable="true"]')?.textContent).toContain(
		"Half a thought",
	);
});
