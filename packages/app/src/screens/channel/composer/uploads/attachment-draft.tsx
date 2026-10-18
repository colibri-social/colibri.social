import { classifyThrown, createLogger } from "@colibri-social/lib";
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
	alt?: string;
};

export type DraftFile = Pick<
	DraftItem,
	"file" | "previewSrc" | "spoiler" | "alt"
>;

export type AttachmentDraftOptions = {
	max?: number;
	maxBytes?: number;
	notify?: (message: string) => void;
	thumbnail?: (file: File) => Promise<string | undefined>;
	reencode?: (file: File) => Promise<File>;
};

export const SERVABLE_IMAGE_TYPES: ReadonlySet<string> = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
]);

const log = createLogger("attachment-draft");

const IMAGE_PREVIEW = /^image\//;
const JPEG_QUALITY = 0.9;

export const needsReencode = (file: File) =>
	IMAGE_PREVIEW.test(file.type) && !SERVABLE_IMAGE_TYPES.has(file.type);

export const tooManyMessage = (max: number) =>
	`You can attach up to ${max} files per message.`;
export const tooLargeMessage = (name: string) =>
	`"${name}" is too large to attach.`;
export const attachedAsFileMessage = (name: string) =>
	`"${name}" couldn't be turned into a picture, so it will be sent as a file.`;

const jpegName = (name: string) => {
	const dot = name.lastIndexOf(".");
	return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
};

const decodeImage = async (file: File) => {
	const source = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = source;
		await image.decode();
		return image;
	} finally {
		URL.revokeObjectURL(source);
	}
};

export const reencodeAsJpeg = async (file: File): Promise<File> => {
	const image = await decodeImage(file);
	const width = image.naturalWidth;
	const height = image.naturalHeight;
	if (!width || !height) throw new Error("image has no size");
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("canvas is unavailable");
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, width, height);
	context.drawImage(image, 0, 0);
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
	);
	if (!blob) throw new Error("image could not be encoded");
	return new File([blob], jpegName(file.name), {
		type: "image/jpeg",
		lastModified: file.lastModified,
	});
};

const asPlainFile = (file: File) =>
	new File([file], file.name, {
		type: "application/octet-stream",
		lastModified: file.lastModified,
	});

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
const describedFiles = new WeakMap<File, string>();
const preparedFiles = new WeakMap<File, File>();

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
	const reencode = options.reencode ?? reencodeAsJpeg;
	const [items, setItems] = createSignal<readonly DraftItem[]>([]);
	let disposed = false;

	const prepare = async (file: File): Promise<File> => {
		const known = preparedFiles.get(file);
		if (known) return known;
		let prepared: File;
		try {
			prepared = await reencode(file);
		} catch (error) {
			log.warn("image re-encode failed", {
				code: classifyThrown(error).code,
				type: file.type,
			});
			notify(attachedAsFileMessage(file.name));
			prepared = asPlainFile(file);
		}
		preparedFiles.set(file, prepared);
		return prepared;
	};

	const accept = (incoming: File[]) => {
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
				...(describedFiles.has(file) ? { alt: describedFiles.get(file) } : {}),
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

	const addFiles = (files: Iterable<File>) => {
		const incoming = [...files];
		if (incoming.length === 0) return;
		if (incoming.some(needsReencode)) {
			void Promise.all(
				incoming.map((file) => (needsReencode(file) ? prepare(file) : file)),
			).then((prepared) => {
				if (!disposed) accept(prepared);
			});
			return;
		}
		accept(incoming);
	};

	const remove = (id: string) => {
		const item = items().find((entry) => entry.id === id);
		if (!item) return;
		revoke(item.previewSrc);
		spoileredFiles.delete(item.file);
		describedFiles.delete(item.file);
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

	const setAlt = (id: string, text: string) => {
		const item = items().find((entry) => entry.id === id);
		if (!item) return;
		const alt = text.trim() || undefined;
		if (alt) describedFiles.set(item.file, alt);
		else describedFiles.delete(item.file);
		setItems((list) =>
			list.map((entry) => (entry.id === id ? { ...entry, alt } : entry)),
		);
	};

	const clear = () => {
		for (const item of items()) revoke(item.previewSrc);
		setItems([]);
	};

	const take = (): DraftFile[] => {
		const taken = items().map(({ file, previewSrc, spoiler, alt }) => ({
			file,
			previewSrc,
			...(spoiler ? { spoiler: true } : {}),
			...(alt ? { alt } : {}),
		}));
		for (const { file } of taken) {
			spoileredFiles.delete(file);
			describedFiles.delete(file);
		}
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

	onCleanup(() => {
		disposed = true;
		clear();
	});

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
					alt: item.alt,
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
					onAltChange={setAlt}
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
		setAlt,
		clear,
		take,
		Tray,
		hasAttachments: () => items().length > 0,
	};
};

export type AttachmentDraft = ReturnType<typeof createAttachmentDraft>;
