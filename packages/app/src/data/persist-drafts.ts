import type {
	EditorJSON,
	RichEditorHandle,
	RichText,
} from "@colibri-social/ui";
import {
	type Accessor,
	createEffect,
	createSignal,
	on,
	onCleanup,
} from "solid-js";
import {
	readStored,
	readStoredJSON,
	writeStored,
	writeStoredJSON,
} from "./persist";

const DRAFT_PREFIX = "colibri:draft:";
const EDIT_PREFIX = "colibri:edit:";
const THREAD_NAME_PREFIX = "colibri:thread-name:";
const LINK_PREVIEWS_PREFIX = "colibri:link-previews:";
const SAVE_DELAY_MS = 300;
const READY_FRAMES = 30;

export const threadStartDraftKey = (channel: string, anchor?: string) =>
	`${channel}#new-thread${anchor ? `:${anchor}` : ""}`;

export const editDraftKey = (channel: string, rkey: string) =>
	`${channel}/${rkey}`;

const isEditorJSON = (value: unknown): value is EditorJSON =>
	!!value &&
	typeof value === "object" &&
	(value as { type?: unknown }).type === "doc";

const isRichText = (value: unknown): value is RichText =>
	!!value &&
	typeof value === "object" &&
	typeof (value as { text?: unknown }).text === "string" &&
	Array.isArray((value as { facets?: unknown }).facets);

export const readComposerDraft = (key: string) =>
	readStoredJSON(DRAFT_PREFIX + key, isEditorJSON);

export const writeComposerDraft = (key: string, json: EditorJSON | undefined) =>
	writeStoredJSON(DRAFT_PREFIX + key, json);

export const readEditDraft = (key: string) =>
	readStoredJSON(EDIT_PREFIX + key, isRichText);

export const writeEditDraft = (key: string, value: RichText | undefined) =>
	writeStoredJSON(EDIT_PREFIX + key, value);

export const readThreadNameDraft = (key: string) =>
	readStored(THREAD_NAME_PREFIX + key) ?? "";

export const writeThreadNameDraft = (key: string, name: string) =>
	writeStored(THREAD_NAME_PREFIX + key, name.trim() ? name : undefined);

export const readLinkPreviewsDraft = (key: string): boolean | undefined => {
	const stored = readStored(LINK_PREVIEWS_PREFIX + key);
	if (stored === "on") return true;
	if (stored === "off") return false;
	return undefined;
};

export const writeLinkPreviewsDraft = (
	key: string,
	show: boolean | undefined,
) =>
	writeStored(
		LINK_PREVIEWS_PREFIX + key,
		show === undefined ? undefined : show ? "on" : "off",
	);

const attachmentDrafts = new Map<string, File[]>();

export const readAttachmentDraft = (key: string): readonly File[] =>
	attachmentDrafts.get(key) ?? [];

export const clearAttachmentDrafts = () => attachmentDrafts.clear();

export const writeAttachmentDraft = (key: string, files: readonly File[]) => {
	if (files.length === 0) attachmentDrafts.delete(key);
	else attachmentDrafts.set(key, [...files]);
};

const whenReady = (
	handle: RichEditorHandle,
	run: () => void,
	frames = READY_FRAMES,
) => {
	if (handle.getJSON() !== undefined) {
		run();
		return;
	}
	if (frames <= 0) return;
	requestAnimationFrame(() => whenReady(handle, run, frames - 1));
};

export type ComposerDraftOptions = {
	key: Accessor<string | undefined>;
	paused?: Accessor<boolean>;
	attachments?: {
		files: Accessor<readonly File[]>;
		add: (files: File[]) => void;
	};
};

export const createComposerDraft = (options: ComposerDraftOptions) => {
	let handle: RichEditorHandle | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pendingKey: string | undefined;
	let alive = true;
	const [linkPreviews, setLinkPreviewsSignal] = createSignal<
		boolean | undefined
	>();

	const forgetLinkPreviews = (key: string) => {
		writeLinkPreviewsDraft(key, undefined);
		if (options.key() === key) setLinkPreviewsSignal(undefined);
	};

	const save = (key: string) => {
		const current = handle;
		if (!current) return;
		const json = current.getJSON();
		if (json === undefined) return;
		const empty = current.isEmpty();
		writeComposerDraft(key, empty ? undefined : json);
		if (empty) forgetLinkPreviews(key);
	};

	const flush = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		const key = pendingKey;
		pendingKey = undefined;
		if (key) save(key);
	};

	const restore = (key: string) => {
		const current = handle;
		if (!current) return;
		whenReady(current, () => {
			if (handle !== current || options.key() !== key) return;
			if (options.paused?.()) return;
			const stored = readComposerDraft(key);
			if (stored && current.isEmpty()) current.setJSON(stored);
		});
	};

	const changed = () => {
		const key = options.key();
		if (!key || options.paused?.()) return;
		if (pendingKey && pendingKey !== key) flush();
		pendingKey = key;
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(flush, SAVE_DELAY_MS);
	};

	const clear = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		pendingKey = undefined;
		const key = options.key();
		if (key) {
			writeComposerDraft(key, undefined);
			writeAttachmentDraft(key, []);
			forgetLinkPreviews(key);
		}
	};

	createEffect(
		on(options.key, (key, previous) => {
			if (previous && previous !== key) flush();
			setLinkPreviewsSignal(key ? readLinkPreviewsDraft(key) : undefined);
			if (!key) return;
			restore(key);
			const attachments = options.attachments;
			if (!attachments) return;
			const files = readAttachmentDraft(key);
			if (files.length > 0 && attachments.files().length === 0) {
				attachments.add([...files]);
			}
		}),
	);

	const attachments = options.attachments;
	if (attachments) {
		createEffect(
			on(
				attachments.files,
				(files) => {
					const key = options.key();
					if (!key) return;
					if (files.length > 0) {
						writeAttachmentDraft(key, files);
						return;
					}
					queueMicrotask(() => {
						if (alive) writeAttachmentDraft(key, []);
					});
				},
				{ defer: true },
			),
		);
	}

	onCleanup(() => {
		alive = false;
		flush();
	});

	return {
		bind: (next: RichEditorHandle) => {
			handle = next;
			const key = options.key();
			if (key) restore(key);
		},
		changed,
		flush,
		clear,
		linkPreviews,
		setLinkPreviews: (show: boolean) => {
			setLinkPreviewsSignal(show);
			const key = options.key();
			if (key) writeLinkPreviewsDraft(key, show);
		},
	};
};

export type ComposerDraft = ReturnType<typeof createComposerDraft>;
