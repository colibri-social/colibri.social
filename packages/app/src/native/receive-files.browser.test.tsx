import { afterEach, expect, it, vi } from "vitest";
import {
	installReceiveFiles,
	RECEIVE_FILES_EVENT,
	type ReceivedFile,
} from "./receive-files";

let uninstall: (() => void) | undefined;

afterEach(() => {
	uninstall?.();
	uninstall = undefined;
	delete (window as { __colibriReceiveFiles?: unknown }).__colibriReceiveFiles;
	document.body.innerHTML = "";
});

const until = async (check: () => boolean, timeout = 2000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

const mountEditor = () => {
	const editor = document.createElement("div");
	editor.className = "ProseMirror";
	editor.contentEditable = "true";
	document.body.append(editor);
	const pasted: File[][] = [];
	editor.addEventListener("paste", (event) => {
		pasted.push(Array.from(event.clipboardData?.files ?? []));
	});
	return { editor, pasted };
};

const fakeFetch = async (entry: ReceivedFile) =>
	new File([new Uint8Array([1, 2, 3])], entry.name, { type: entry.type });

const receive = (detail: unknown) =>
	window.dispatchEvent(new CustomEvent(RECEIVE_FILES_EVENT, { detail }));

it("pastes received files into the focused composer", async () => {
	const { editor, pasted } = mountEditor();
	uninstall = installReceiveFiles({ fetchFile: fakeFetch });
	editor.focus();
	receive([
		{
			name: "photo.png",
			type: "image/png",
			url: "http://colibri-files.localhost/a.png",
		},
		{
			name: "clip.mp4",
			type: "video/mp4",
			url: "http://colibri-files.localhost/b.mp4",
		},
	]);
	await until(() => pasted.length === 1);
	expect(pasted[0]?.map((file) => [file.name, file.type])).toEqual([
		["photo.png", "image/png"],
		["clip.mp4", "video/mp4"],
	]);
});

it("falls back to the last focused composer when nothing has focus", async () => {
	const { editor, pasted } = mountEditor();
	uninstall = installReceiveFiles({ fetchFile: fakeFetch });
	editor.focus();
	editor.blur();
	receive([{ name: "a.png", type: "image/png", url: "u" }]);
	await until(() => pasted.length === 1);
});

it("ignores malformed events and failed downloads", async () => {
	const { editor, pasted } = mountEditor();
	uninstall = installReceiveFiles({ fetchFile: async () => undefined });
	editor.focus();
	receive("nope");
	receive([{ name: 1 }]);
	receive([{ name: "a.png", type: "image/png", url: "u" }]);
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(pasted).toEqual([]);
});

it("asks the native clipboard for media when a paste carries nothing", () => {
	const { editor } = mountEditor();
	const readClipboard = vi.fn(() => true);
	(window as { __colibriReceiveFiles?: unknown }).__colibriReceiveFiles = {
		readClipboard,
	};
	uninstall = installReceiveFiles({ fetchFile: fakeFetch });
	const empty = new ClipboardEvent("paste", {
		clipboardData: new DataTransfer(),
		bubbles: true,
		cancelable: true,
	});
	editor.dispatchEvent(empty);
	expect(readClipboard).toHaveBeenCalledTimes(1);
	expect(empty.defaultPrevented).toBe(true);

	const text = new DataTransfer();
	text.setData("text/plain", "hello");
	editor.dispatchEvent(
		new ClipboardEvent("paste", { clipboardData: text, bubbles: true }),
	);
	expect(readClipboard).toHaveBeenCalledTimes(1);
});
