import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { Did } from "../../data/types";
import {
	articleWithText,
	HQ,
	main,
	menuItem,
	mount,
	rightClick,
	until,
	wait,
} from "./desktop-test-kit";

const MESSAGE = "Heads up: the beta API";

const holdShift = (held: boolean) =>
	window.dispatchEvent(
		new KeyboardEvent(held ? "keydown" : "keyup", {
			key: "Shift",
			shiftKey: held,
		}),
	);

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

afterEach(() => holdShift(false));

it("lets a moderator keep hidden messages out of view, globally or per Space", async () => {
	const { store } = await mount();
	const article = await findArticle(MESSAGE);
	const key = article.getAttribute("data-message-key");
	rightClick(article);
	await until(() => !!document.querySelector("[role='menu']"));
	await wait(50);
	holdShift(true);
	await userEvent.click(menuItem("Hide message") as HTMLElement);
	holdShift(false);
	const byKey = () =>
		main().querySelector<HTMLElement>(`article[data-message-key="${key}"]`);
	await until(() => !!byKey()?.querySelector("[data-hidden-message]"));

	await store.preferences.setClient({ hideModeratedMessages: true });
	await until(() => !byKey());

	await store.preferences.setSpaceModeration(HQ as Did, false);
	await until(() => !!byKey()?.querySelector("[data-hidden-message]"));

	await store.preferences.setSpaceModeration(HQ as Did, undefined);
	await until(() => !byKey());
	expect(articleWithText(main(), MESSAGE)).toBeUndefined();
});
