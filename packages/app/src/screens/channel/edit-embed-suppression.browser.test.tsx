import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { SendMessageInput } from "../../data/source";
import {
	articleWithText,
	main,
	mainEditor,
	menuItem,
	mount,
	rightClick,
	until,
	wait,
} from "./desktop-test-kit";

const FIRST = "https://example.com/first";
const SECOND = "https://example.com/second";

type EditInput = { text: string; suppressedEmbeds?: string[] };

const mountRecording = async () => {
	const { store, source } = await mount();
	const sent: SendMessageInput[] = [];
	const edits: EditInput[] = [];
	const sendMessage = source.sendMessage;
	const editMessage = source.editMessage;

	source.sendMessage = (input) => {
		sent.push(input);

		return sendMessage(input);
	};

	source.editMessage = (input) => {
		edits.push(input);

		return editMessage(input);
	};

	await store.preferences.setClient({ linkEmbedsByDefault: true });

	return { sent, edits };
};

const sendTyped = async (typed: string, marker: string) => {
	await userEvent.click(mainEditor());
	await userEvent.keyboard(typed);
	await userEvent.keyboard("{Enter}");
	await until(() => !!articleWithText(main(), marker));
	await wait(150);

	return articleWithText(main(), marker) as HTMLElement;
};

const inlineEditor = (article: HTMLElement) =>
	article.querySelector<HTMLElement>(
		"[data-message-editor] [contenteditable='true']",
	);

const startEdit = async (article: HTMLElement) => {
	await until(() => !document.querySelector("[role='menu']"));
	rightClick(article);
	await until(() => !!menuItem("Edit message"));
	await userEvent.click(menuItem("Edit message") as HTMLElement);
	await until(() => !!inlineEditor(article));

	return inlineEditor(article) as HTMLElement;
};

const replaceEdit = async (editor: HTMLElement, typed: string) => {
	await userEvent.click(editor);
	await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
	await userEvent.keyboard(typed);
	await userEvent.keyboard("{Enter}");
};

it("sends angle bracket links with their previews turned off", async () => {
	const { sent } = await mountRecording();

	await sendTyped(`Alpha <${FIRST}> and [[docs](<${SECOND}>)`, "Alpha");

	expect(sent.at(-1)?.suppressedEmbeds).toEqual([FIRST, SECOND]);
});

it("shows stored entries as brackets when editing", async () => {
	await mountRecording();
	const article = await sendTyped(`Bravo <${FIRST}> now`, "Bravo");
	const editor = await startEdit(article);

	expect(editor.textContent).toContain(`<${FIRST}>`);
});

it("brings the preview back when an edit removes the brackets", async () => {
	const { edits } = await mountRecording();
	const article = await sendTyped(`Charlie <${FIRST}> now`, "Charlie");
	const editor = await startEdit(article);

	await replaceEdit(editor, `Charlie ${FIRST} now`);
	await until(() => edits.length > 0);

	expect(edits.at(-1)?.suppressedEmbeds).toEqual([]);
});

it("suppresses a link when an edit adds brackets", async () => {
	const { edits } = await mountRecording();
	const article = await sendTyped(`Delta ${FIRST} now`, "Delta");
	const editor = await startEdit(article);

	expect(editor.textContent).not.toContain(`<${FIRST}>`);

	await replaceEdit(editor, `Delta ${FIRST} and <${SECOND}>`);
	await until(() => edits.length > 0);

	expect(edits.at(-1)?.suppressedEmbeds).toEqual([SECOND]);
});
