import { HIDDEN_REASON_TEXT, REPLY_BLOCKED_TEXT } from "@colibri-social/ui";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { skeyOf } from "../../data/ids";
import { didFor } from "../../data/mock/people";
import type { Block } from "../../data/preferences/types";
import type { Datetime, Did, SpaceRef } from "../../data/types";
import {
	articleWithText,
	HQ,
	main,
	mainEditor,
	mount,
	TEXT,
	until,
	wait,
} from "./desktop-test-kit";

const GENERAL_PATH = `/app/c/${HQ}/${TEXT}/general`;
const NOOR = didFor("noor");
const NOOR_NAME = "Noor Haddad";
const QUESTION = "Is there a way to switch to the light theme yet";
const ANSWER = "It follows the system by default.";

const blockOf = (subject: Did): Block => {
	return { subject, createdAt: "2026-11-01T10:00:00.000Z" as Datetime };
};

const findArticle = async (text: string) => {
	const scroller = main().querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;
	const started = performance.now();

	while (!articleWithText(main(), text)) {
		if (performance.now() - started > 8000)
			throw new Error(`No message with ${text}`);
		scroller.scrollTop = Math.max(0, scroller.scrollTop - 600);
		await wait(80);
	}

	articleWithText(main(), text)?.scrollIntoView({ block: "center" });
	await wait(200);

	return articleWithText(main(), text) as HTMLElement;
};

const byKey = (key: string) => {
	return main().querySelector<HTMLElement>(
		`article[data-message-key="${key}"]`,
	);
};

const buttonIn = (root: HTMLElement, name: string) => {
	return Array.from(root.querySelectorAll<HTMLElement>("button")).find(
		(button) => button.textContent?.trim() === name,
	);
};

it("collapses a blocked author's messages until the viewer shows them", async () => {
	const { source } = await mount(GENERAL_PATH, { blocks: [blockOf(NOOR)] });
	const hq = source.world.spaces.find((entry) => entry.seed.key === "hq");
	const general = hq?.channels.find(
		(entry) => skeyOf(entry.view.space) === "general",
	);
	const question = general
		? source.world
				.messagesOf(general)
				.find((message) => message.text.includes(QUESTION))
		: undefined;

	if (!question) throw new Error("fixture missing");

	const answer = await findArticle(ANSWER);
	const answerKey = answer.getAttribute("data-message-key") as string;
	const parent = () => byKey(question.rkey) as HTMLElement;
	const reply = () => byKey(answerKey) as HTMLElement;

	await until(() => !!parent());

	expect(parent()).toHaveAttribute("data-anonymous");
	expect(parent().querySelector("[data-message-header]")).toBeNull();
	expect(parent().textContent).toContain(HIDDEN_REASON_TEXT.blocked);
	expect(parent().textContent).not.toContain(QUESTION);
	expect(parent().textContent).not.toContain(NOOR_NAME);
	expect(reply().querySelector('[data-reply-masked="blocked"]')).not.toBeNull();
	expect(reply().textContent).toContain(REPLY_BLOCKED_TEXT);
	expect(reply().textContent).not.toContain(NOOR_NAME);

	const masked = reply().querySelector<HTMLElement>(
		'[data-reply-masked="blocked"]',
	);
	const jump = masked?.closest("button") ?? masked;

	parent().scrollIntoView({ block: "end" });
	await wait(100);
	(jump as HTMLElement).click();
	await until(() => parent().getAttribute("data-highlight") === "jumped");

	await userEvent.click(buttonIn(parent(), "Show") as HTMLElement);
	await until(() => !parent().hasAttribute("data-anonymous"));

	expect(parent().textContent).toContain(QUESTION);
	expect(parent().querySelector("[data-author-name]")?.textContent).toContain(
		NOOR_NAME,
	);
	await until(() => !reply().querySelector('[data-reply-masked="blocked"]'));
	expect(reply().textContent).toContain(NOOR_NAME);

	await userEvent.click(buttonIn(parent(), "Hide again") as HTMLElement);
	await until(() => parent().hasAttribute("data-anonymous"));

	expect(parent().textContent).not.toContain(QUESTION);
	expect(reply().querySelector('[data-reply-masked="blocked"]')).not.toBeNull();
});

const sidebar = () => {
	return document.querySelector<HTMLElement>("[data-members-desktop]");
};

const memberNamed = (name: string) => {
	return Array.from(
		sidebar()?.querySelectorAll("[data-member-row]") ?? [],
	).find(
		(row) => row.querySelector("[data-member-name]")?.textContent === name,
	);
};

it("leaves blocked people out of typing, mention suggestions and the member list", async () => {
	const { store, source } = await mount();

	await until(() => !!memberNamed(NOOR_NAME));
	await store.preferences.setBlocked(NOOR, true);
	await until(() => !memberNamed(NOOR_NAME));

	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;

	if (!dev) throw new Error("dev missing");

	const channel = dev.space as SpaceRef;
	const typing = () => {
		return main().querySelector("[data-composer-typing]") as HTMLElement;
	};

	source.emit({ $type: "typingEvent", did: NOOR, channel });
	source.emit({ $type: "typingEvent", did: didFor("priya"), channel });
	await until(() => !!typing().textContent?.includes("Priya"));

	expect(typing().textContent).not.toContain("Noor");

	const suggestions = () => {
		return main().querySelector<HTMLElement>("[data-suggestions]");
	};

	await userEvent.click(mainEditor());
	await userEvent.keyboard("@noo");
	await wait(400);

	expect(suggestions()?.textContent ?? "").not.toContain(NOOR_NAME);

	await userEvent.keyboard("{Backspace}{Backspace}{Backspace}pri");
	await until(() => !!suggestions()?.textContent?.includes("Priya"));

	expect(suggestions()?.textContent).not.toContain(NOOR_NAME);

	await userEvent.keyboard("{Escape}");
	await store.preferences.setBlocked(NOOR, false);
	await until(() => !!memberNamed(NOOR_NAME));
});
