import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	type AttachmentDraft,
	attachedAsFileMessage,
	createAttachmentDraft,
	reencodeAsJpeg,
	tooLargeMessage,
	tooManyMessage,
} from "./attachment-draft";

const file = (name: string, size = 10, type = "text/plain") =>
	new File([new Uint8Array(size)], name, { type });

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

const setup = (
	options: {
		max?: number;
		maxBytes?: number;
		reencode?: (file: File) => Promise<File>;
	} = {},
) => {
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

const pngBlob = () =>
	new Promise<Blob>((resolve, reject) => {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 3;
		const context = canvas.getContext("2d");
		if (context) {
			context.fillStyle = "#ff0000";
			context.fillRect(0, 0, 4, 3);
		}
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
			"image/png",
		);
	});

const until = async (check: () => boolean) => {
	for (let round = 0; round < 50 && !check(); round++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

describe("image conversion", () => {
	it("re-encodes an image type the AppView can't serve before it joins the tray", async () => {
		const converted = new File([new Uint8Array(4)], "photo.jpg", {
			type: "image/jpeg",
		});
		const { draft } = setup({ reencode: async () => converted });
		draft.addFiles([file("notes.txt"), file("photo.heic", 10, "image/heic")]);
		expect(draft.items()).toHaveLength(0);
		await until(() => draft.items().length === 2);
		expect(draft.items().map((item) => item.file)).toEqual([
			expect.objectContaining({ name: "notes.txt" }),
			converted,
		]);
		expect(draft.items()[1]?.previewSrc?.startsWith("blob:")).toBe(true);
	});

	it("leaves JPEG, PNG, GIF, WebP and AVIF alone", () => {
		let calls = 0;
		const { draft } = setup({
			reencode: async (input) => {
				calls += 1;
				return input;
			},
		});
		draft.addFiles(
			["jpeg", "png", "gif", "webp", "avif"].map((type) =>
				file(`a.${type}`, 10, `image/${type}`),
			),
		);
		expect(draft.items()).toHaveLength(5);
		expect(calls).toBe(0);
	});

	it("attaches an image as a plain file when it can't be decoded", async () => {
		const { draft, notices } = setup({
			reencode: async () => {
				throw new Error("decode failed");
			},
		});
		draft.addFiles([file("scan.tiff", 10, "image/tiff")]);
		await until(() => draft.items().length === 1);
		const [item] = draft.items();
		expect(item?.file.name).toBe("scan.tiff");
		expect(item?.file.type).toBe("application/octet-stream");
		expect(item?.previewSrc).toBeUndefined();
		expect(notices).toEqual([attachedAsFileMessage("scan.tiff")]);
	});

	it("turns a decodable image into a JPEG", async () => {
		const source = new File([await pngBlob()], "drawing.bmp", {
			type: "image/bmp",
		});
		const jpeg = await reencodeAsJpeg(source);
		expect(jpeg.type).toBe("image/jpeg");
		expect(jpeg.name).toBe("drawing.jpg");
		const header = new Uint8Array(await jpeg.slice(0, 3).arrayBuffer());
		expect([...header]).toEqual([0xff, 0xd8, 0xff]);
	});

	it("falls back to a plain file when the browser can't decode the image", async () => {
		const { draft, notices } = setup();
		draft.addFiles([file("broken.heic", 10, "image/heic")]);
		await until(() => draft.items().length === 1);
		expect(draft.items()[0]?.file.type).toBe("application/octet-stream");
		expect(notices).toEqual([attachedAsFileMessage("broken.heic")]);
	});
});

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

	it("adds alt text from the tray and hands it over on send", async () => {
		const { draft } = setup();
		const host = document.createElement("div");
		document.body.append(host);
		const stop = render(() => <draft.Tray />, host);
		draft.addFiles([file("bird.png", 10, "image/png"), file("notes.pdf")]);
		await expect
			.element(page.getByRole("button", { name: "Add alt text to bird.png" }))
			.toBeVisible();
		expect(
			host.querySelector('button[aria-label="Add alt text to notes.pdf"]'),
		).toBeNull();
		expect(host.querySelector("img")?.getAttribute("alt")).toBe("");
		await userEvent.click(
			page.getByRole("button", { name: "Add alt text to bird.png" }),
		);
		const dialog = page.getByRole("dialog", { name: "Add alt text" });
		await expect.element(dialog).toBeVisible();
		await userEvent.fill(
			dialog.getByRole("textbox", { name: "Alt text" }),
			"  A colibri at a flower  ",
		);
		await userEvent.click(dialog.getByRole("button", { name: "Save" }));
		await expect.element(dialog).not.toBeInTheDocument();
		expect(draft.items()[0]?.alt).toBe("A colibri at a flower");
		await expect
			.element(page.getByRole("button", { name: "Edit alt text for bird.png" }))
			.toBeVisible();
		const taken = draft.take();
		expect(taken.map((entry) => entry.alt)).toEqual([
			"A colibri at a flower",
			undefined,
		]);
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
