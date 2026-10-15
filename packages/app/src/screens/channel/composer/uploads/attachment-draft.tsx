import {
	AttachmentTray,
	type PendingAttachment,
	toast,
} from "@colibri-social/ui";
import {
	type Component,
	createRenderEffect,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "../../../../data/source";

export type DraftItem = {
	id: string;
	file: File;
	previewSrc?: string;
	spoiler?: boolean;
};

export type DraftFile = Pick<DraftItem, "file" | "previewSrc" | "spoiler">;

export type AttachmentDraftOptions = {
	max?: number;
	maxBytes?: number;
	notify?: (message: string) => void;
	thumbnail?: (file: File) => Promise<string | undefined>;
};

const IMAGE_PREVIEW = /^image\//;

export const tooManyMessage = (max: number) =>
	`You can attach up to ${max} files per message.`;
export const tooLargeMessage = (name: string) =>
	`"${name}" is too large to attach.`;

export const videoThumbnail = (file: File) =>
	new Promise<string | undefined>((resolve) => {
		const source = URL.createObjectURL(file);
		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.preload = "metadata";
		const done = (value: string | undefined) => {
			URL.revokeObjectURL(source);
			resolve(value);
		};
		video.onloadeddata = () => {
			const canvas = document.createElement("canvas");
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const context = canvas.getContext("2d");
			if (!context || !canvas.width) {
				done(undefined);
				return;
			}
			context.drawImage(video, 0, 0);
			canvas.toBlob((blob) =>
				done(blob ? URL.createObjectURL(blob) : undefined),
			);
		};
		video.onerror = () => done(undefined);
		video.src = source;
	});

const spoileredFiles = new WeakSet<File>();

let counter = 0;
const nextId = () => `draft-${Date.now().toString(36)}-${counter++}`;

const revoke = (src: string | undefined) => {
	if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
};

export const createAttachmentDraft = (options: AttachmentDraftOptions = {}) => {
	const max = options.max ?? MAX_ATTACHMENTS;
	const maxBytes = options.maxBytes ?? MAX_ATTACHMENT_BYTES;
	const notify = options.notify ?? ((message: string) => toast.error(message));
	const thumbnail = options.thumbnail ?? videoThumbnail;
	const [items, setItems] = createSignal<readonly DraftItem[]>([]);

	const addFiles = (files: Iterable<File>) => {
		const incoming = [...files];
		if (incoming.length === 0) return;
		const room = max - items().length;
		if (incoming.length > room) notify(tooManyMessage(max));
		const accepted: DraftItem[] = [];
		for (const file of incoming.slice(0, Math.max(0, room))) {
			if (file.size > maxBytes) {
				notify(tooLargeMessage(file.name));
				continue;
			}
			accepted.push({
				id: nextId(),
				file,
				previewSrc: IMAGE_PREVIEW.test(file.type)
					? URL.createObjectURL(file)
					: undefined,
				...(spoileredFiles.has(file) ? { spoiler: true } : {}),
			});
		}
		if (accepted.length === 0) return;
		setItems((list) => [...list, ...accepted]);
		for (const item of accepted) {
			if (!item.file.type.startsWith("video/")) continue;
			void thumbnail(item.file).then((src) => {
				if (!src) return;
				if (!items().some((entry) => entry.id === item.id)) {
					revoke(src);
					return;
				}
				setItems((list) =>
					list.map((entry) =>
						entry.id === item.id ? { ...entry, previewSrc: src } : entry,
					),
				);
			});
		}
	};

	const remove = (id: string) => {
		const item = items().find((entry) => entry.id === id);
		if (!item) return;
		revoke(item.previewSrc);
		spoileredFiles.delete(item.file);
		setItems((list) => list.filter((entry) => entry.id !== id));
	};

	const toggleSpoiler = (id: string) => {
		const item = items().find((entry) => entry.id === id);
		if (!item) return;
		const spoiler = !item.spoiler;
		if (spoiler) spoileredFiles.add(item.file);
		else spoileredFiles.delete(item.file);
		setItems((list) =>
			list.map((entry) => (entry.id === id ? { ...entry, spoiler } : entry)),
		);
	};

	const clear = () => {
		for (const item of items()) revoke(item.previewSrc);
		setItems([]);
	};

	const take = (): DraftFile[] => {
		const taken = items().map(({ file, previewSrc, spoiler }) => ({
			file,
			previewSrc,
			...(spoiler ? { spoiler: true } : {}),
		}));
		for (const { file } of taken) spoileredFiles.delete(file);
		setItems([]);
		return taken;
	};

	const pick = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.style.display = "none";
		input.addEventListener(
			"change",
			() => {
				if (input.files) addFiles(input.files);
				input.remove();
			},
			{ once: true },
		);
		input.addEventListener("cancel", () => input.remove(), { once: true });
		document.body.append(input);
		input.click();
	};

	onCleanup(() => clear());

	const [trayItems, setTrayItems] = createStore<PendingAttachment[]>([]);
	createRenderEffect(() =>
		setTrayItems(
			reconcile(
				items().map((item) => ({
					id: item.id,
					name: item.file.name,
					size: item.file.size,
					previewSrc: item.previewSrc,
					spoiler: item.spoiler,
				})),
				{ key: "id" },
			),
		),
	);

	const Tray: Component = () => (
		<Show when={items().length > 0}>
			<div data-attachment-draft="" class="flex flex-col">
				<AttachmentTray
					items={trayItems}
					max={max}
					onRemove={remove}
					onToggleSpoiler={toggleSpoiler}
				/>
			</div>
		</Show>
	);

	return {
		items,
		pick,
		addFiles,
		remove,
		toggleSpoiler,
		clear,
		take,
		Tray,
		hasAttachments: () => items().length > 0,
	};
};

export type AttachmentDraft = ReturnType<typeof createAttachmentDraft>;
