import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import {
	type AttachmentDraft,
	createAttachmentDraft,
	tooLargeMessage,
	tooManyMessage,
} from "./attachment-draft";

const file = (name: string, size = 10, type = "text/plain") =>
	new File([new Uint8Array(size)], name, { type });

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

const setup = (options: { max?: number; maxBytes?: number } = {}) => {
	const notices: string[] = [];
	let draft: AttachmentDraft | undefined;
	createRoot((done) => {
		dispose = done;
		draft = createAttachmentDraft({
			...options,
			notify: (message) => notices.push(message),
			thumbnail: async () => undefined,
		});
	});
	return { draft: draft as AttachmentDraft, notices };
};

describe("attachment draft", () => {
	it("keeps files local until they are taken for sending", () => {
		const { draft } = setup();
		draft.addFiles([file("a.txt"), file("b.png", 10, "image/png")]);
		expect(draft.items()).toHaveLength(2);
		expect(draft.items()[1]?.previewSrc?.startsWith("blob:")).toBe(true);
		const taken = draft.take();
		expect(taken.map((entry) => entry.file.name)).toEqual(["a.txt", "b.png"]);
		expect(draft.items()).toHaveLength(0);
		expect(draft.hasAttachments()).toBe(false);
	});

	it("caps the number of files", () => {
		const { draft, notices } = setup({ max: 2 });
		draft.addFiles([file("a"), file("b"), file("c")]);
		expect(draft.items()).toHaveLength(2);
		expect(notices).toEqual([tooManyMessage(2)]);
		draft.addFiles([file("d")]);
		expect(draft.items()).toHaveLength(2);
	});

	it("rejects files over the size limit", () => {
		const { draft, notices } = setup({ maxBytes: 100 });
		draft.addFiles([file("big.bin", 200), file("small.bin", 50)]);
		expect(draft.items().map((item) => item.file.name)).toEqual(["small.bin"]);
		expect(notices).toEqual([tooLargeMessage("big.bin")]);
	});

	it("removes a file and frees its preview", () => {
		const { draft } = setup();
		draft.addFiles([file("a.png", 10, "image/png")]);
		const [item] = draft.items();
		draft.remove(item?.id ?? "");
		expect(draft.items()).toHaveLength(0);
	});

	it("marks a file as a spoiler and hands the flag over on send", () => {
		const { draft } = setup();
		draft.addFiles([file("ending.png", 10, "image/png"), file("notes.pdf")]);
		const [first] = draft.items();
		draft.toggleSpoiler(first?.id ?? "");
		expect(draft.items().map((item) => !!item.spoiler)).toEqual([true, false]);
		draft.toggleSpoiler(first?.id ?? "");
		expect(draft.items()[0]?.spoiler).toBe(false);
		draft.toggleSpoiler(first?.id ?? "");
		const taken = draft.take();
		expect(taken.map((entry) => entry.spoiler)).toEqual([true, undefined]);
	});

	it("remembers the spoiler mark when the same file comes back", () => {
		const { draft } = setup();
		const kept = file("ending.png", 10, "image/png");
		draft.addFiles([kept]);
		draft.toggleSpoiler(draft.items()[0]?.id ?? "");
		draft.clear();
		draft.addFiles([kept]);
		expect(draft.items()[0]?.spoiler).toBe(true);
	});

	it("toggles the spoiler mark from the tray", async () => {
		const { draft } = setup();
		const host = document.createElement("div");
		document.body.append(host);
		const stop = render(() => <draft.Tray />, host);
		draft.addFiles([file("notes.pdf", 10, "application/pdf")]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const toggle = host.querySelector<HTMLButtonElement>(
			'button[aria-label="Mark notes.pdf as a spoiler"]',
		);
		expect(toggle?.getAttribute("aria-pressed")).toBe("false");
		toggle?.click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(toggle?.getAttribute("aria-pressed")).toBe("true");
		expect(draft.items()[0]?.spoiler).toBe(true);
		stop();
		host.remove();
	});

	it("renders a tray without upload progress", async () => {
		const { draft } = setup();
		const host = document.createElement("div");
		document.body.append(host);
		const stop = render(() => <draft.Tray />, host);
		draft.addFiles([file("notes.pdf", 10, "application/pdf")]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(host.querySelector('[role="progressbar"]')).toBeNull();
		expect(
			host.querySelector('button[aria-label="Remove notes.pdf"]'),
		).not.toBeNull();
		stop();
		host.remove();
	});
});
