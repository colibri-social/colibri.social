export const RECEIVE_FILES_EVENT = "colibri-receive-files";

export type ReceivedFile = { name: string; type: string; url: string };

type ReceiveBridge = { readClipboard: () => boolean };

const bridge = () =>
	(window as { __colibriReceiveFiles?: ReceiveBridge }).__colibriReceiveFiles;

const isReceivedFile = (value: unknown): value is ReceivedFile => {
	if (!value || typeof value !== "object") return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.name === "string" &&
		typeof entry.type === "string" &&
		typeof entry.url === "string"
	);
};

const editorOf = (target: EventTarget | null) =>
	target instanceof Element
		? target.closest<HTMLElement>(".ProseMirror")
		: null;

const hasFiles = (data: DataTransfer | null) =>
	!!data &&
	(data.files.length > 0 ||
		Array.from(data.items).some((item) => item.kind === "file"));

const download = async (entry: ReceivedFile): Promise<File | undefined> => {
	try {
		const response = await fetch(entry.url);
		if (!response.ok) return undefined;
		const blob = await response.blob();
		return new File([blob], entry.name, { type: entry.type || blob.type });
	} catch {
		return undefined;
	}
};

export const installReceiveFiles = (
	options: {
		fetchFile?: (entry: ReceivedFile) => Promise<File | undefined>;
	} = {},
): (() => void) => {
	if (typeof window === "undefined") return () => {};
	const fetchFile = options.fetchFile ?? download;
	let lastEditor: HTMLElement | undefined;

	const target = () => {
		const focused = editorOf(document.activeElement);
		if (focused) return focused;
		return lastEditor?.isConnected ? lastEditor : undefined;
	};

	const deliver = (files: File[]) => {
		const editor = target();
		if (!editor || files.length === 0) return;
		const data = new DataTransfer();
		for (const file of files) data.items.add(file);
		editor.dispatchEvent(
			new ClipboardEvent("paste", {
				clipboardData: data,
				bubbles: true,
				cancelable: true,
			}),
		);
	};

	const onFocusIn = (event: FocusEvent) => {
		const editor = editorOf(event.target);
		if (editor) lastEditor = editor;
	};

	const onReceive = (event: Event) => {
		const detail = (event as CustomEvent<unknown>).detail;
		if (!Array.isArray(detail)) return;
		const entries = detail.filter(isReceivedFile);
		if (entries.length === 0) return;
		void Promise.all(entries.map(fetchFile)).then((files) =>
			deliver(files.filter((file): file is File => !!file)),
		);
	};

	const onPaste = (event: ClipboardEvent) => {
		const native = bridge();
		if (!native || !editorOf(event.target)) return;
		const data = event.clipboardData;
		if (hasFiles(data) || data?.getData("text/plain")) return;
		if (native.readClipboard()) event.preventDefault();
	};

	document.addEventListener("focusin", onFocusIn, true);
	document.addEventListener("paste", onPaste, true);
	window.addEventListener(RECEIVE_FILES_EVENT, onReceive);
	return () => {
		document.removeEventListener("focusin", onFocusIn, true);
		document.removeEventListener("paste", onPaste, true);
		window.removeEventListener(RECEIVE_FILES_EVENT, onReceive);
	};
};
