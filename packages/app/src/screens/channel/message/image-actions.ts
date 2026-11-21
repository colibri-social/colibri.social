import { classifyThrown, createLogger } from "@colibri-social/lib";
import { toast } from "@colibri-social/ui";
import { classifyNativeError } from "../../../auth/native";
import { describeError } from "../../../data/error-copy";
import { isLinuxApp } from "../../../data/screen-share";
import { isNativeShell } from "../../../shell/desktop/window-chrome";

const log = createLogger("image-actions");

export type ImageTarget = { src: string; name?: string };

export type MediaTarget = { src: string; name?: string; mimeType?: string };

type MediaGroup = "image" | "gif" | "video" | "audio" | "file";

const FALLBACK_TYPE = "application/octet-stream";

const EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/quicktime": "mov",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"audio/aac": "aac",
	"audio/ogg": "ogg",
	"audio/wav": "wav",
	"audio/flac": "flac",
	"application/pdf": "pdf",
	"application/zip": "zip",
	"text/plain": "txt",
};

const NOUNS: Record<MediaGroup, string> = {
	image: "image",
	gif: "GIF",
	video: "video",
	audio: "audio file",
	file: "file",
};

const ANDROID_FOLDERS: Record<MediaGroup, string> = {
	image: "Pictures",
	gif: "Pictures",
	video: "Movies",
	audio: "Music",
	file: "Downloads",
};

const groupOf = (type: string | undefined): MediaGroup => {
	const normalized = type?.toLowerCase() ?? "";

	if (normalized === "image/gif") return "gif";
	if (normalized.startsWith("image/")) return "image";
	if (normalized.startsWith("video/")) return "video";
	if (normalized.startsWith("audio/")) return "audio";

	return "file";
};

const nativeFetch = async (src: string) => {
	const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

	return tauriFetch(src, { method: "GET" });
};

const fetchResponse = async (src: string) => {
	try {
		return await fetch(src);
	} catch (thrown) {
		if (!isNativeShell()) throw thrown;

		return nativeFetch(src);
	}
};

export const fetchMedia = async (src: string, fallbackType?: string) => {
	const response = await fetchResponse(src);

	if (!response.ok) throw new Error(`media request failed: ${response.status}`);

	const header = response.headers
		.get("content-type")
		?.split(";")[0]
		?.trim()
		.toLowerCase();
	const type =
		header && header !== FALLBACK_TYPE ? header : (fallbackType ?? header);
	const blob = await response.blob();

	return type && blob.type !== type ? new Blob([blob], { type }) : blob;
};

const isAndroid = () => {
	return (
		typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
	);
};

type DownloadProgress = {
	received: number;
	total?: number | null;
};

type SavedFile = {
	name: string;
	type: string;
	destination?: string | null;
};

const SAVE_COMMAND = "save_url";
const PLAYER_COMMAND = "open_media_url";

const webUrlOf = (src: string) => {
	try {
		const url = new URL(src, location.href);

		return url.protocol === "https:" || url.protocol === "http:"
			? url.href
			: undefined;
	} catch {
		return undefined;
	}
};

const toPng = async (blob: Blob): Promise<Blob> => {
	if (blob.type === "image/png") return blob;

	const bitmap = await createImageBitmap(blob);
	const canvas = document.createElement("canvas");

	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
	bitmap.close();

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(png) => (png ? resolve(png) : reject(new Error("png encode failed"))),
			"image/png",
		),
	);
};

const HAS_EXTENSION = /\.[a-z0-9]{2,5}$/i;

const nameFromUrl = (src: string) => {
	try {
		const segment = new URL(src, location.href).pathname
			.split("/")
			.filter(Boolean)
			.at(-1);

		return segment && HAS_EXTENSION.test(segment)
			? decodeURIComponent(segment)
			: undefined;
	} catch {
		return undefined;
	}
};

const mediaFileName = (target: MediaTarget, type: string | undefined) => {
	const extension = EXTENSIONS[type ?? ""];
	const named = target.name?.trim();

	if (named)
		return HAS_EXTENSION.test(named) || !extension
			? named
			: `${named}.${extension}`;

	const fromUrl = nameFromUrl(target.src);

	if (fromUrl) return fromUrl;

	const base = `${groupOf(type)}-${Date.now()}`;

	return extension ? `${base}.${extension}` : base;
};

type MediaAction = "copy" | "download";

const blockedCopy = (action: MediaAction, group: MediaGroup) => {
	const noun = NOUNS[group];
	const viewable = group !== "audio" && group !== "file";
	const openHint = viewable ? " You can still open it in full size." : "";

	if (action === "copy")
		return {
			title: `This ${noun} can't be copied yet`,
			description: `Where it's stored doesn't let Colibri copy it so far.${openHint}`,
		};

	return {
		title: `This ${noun} can't be downloaded yet`,
		description: `Where it's stored doesn't let Colibri save it so far.${openHint}`,
	};
};

const isBlocked = (thrown: unknown) => {
	if (isNativeShell()) return false;
	if (typeof navigator !== "undefined" && navigator.onLine === false)
		return false;
	if (thrown instanceof TypeError) return true;

	return thrown instanceof DOMException && thrown.name === "SecurityError";
};

const failure = (action: MediaAction, group: MediaGroup, thrown: unknown) => {
	const method = `media.${action}`;

	if (isBlocked(thrown)) {
		log.warn(`${method} blocked`, { reason: "cross-origin" });

		const copy = blockedCopy(action, group);

		toast.error(copy.title, { description: copy.description });

		return;
	}

	const error = classifyThrown(thrown, { method });

	log.warn(`${method} failed`, { code: error.code });

	const copy = describeError(error);
	const verb = action === "copy" ? "copy" : "download";

	toast.error(`Couldn't ${verb} the ${NOUNS[group]}`, {
		description: copy.description ?? "Give it another try.",
	});
};

export const copyImage = async (target: ImageTarget) => {
	try {
		const png = fetchMedia(target.src).then(toPng);

		await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
		toast.success("Image copied");
	} catch (thrown) {
		failure("copy", "image", thrown);
	}
};

const saveInBrowser = (blob: Blob, name: string) => {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	anchor.href = url;
	anchor.download = name;
	anchor.rel = "noopener";
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const nativeFileName = (target: MediaTarget) => {
	if (target.name?.trim() || target.mimeType)
		return mediaFileName(target, target.mimeType);

	return nameFromUrl(target.src);
};

const savedMessage = (saved: SavedFile) => {
	if (saved.destination === "photos") return `Saved ${saved.name} to Photos`;
	if (isAndroid())
		return `Saved ${saved.name} to ${ANDROID_FOLDERS[groupOf(saved.type)]}`;

	return `Saved ${saved.name}`;
};

const nativeFailure = (group: MediaGroup, thrown: unknown) => {
	const error = classifyNativeError(thrown, SAVE_COMMAND);

	log.warn("media.download failed", { code: error.code });

	if (error.code === "NativeCancelled") return;

	if (error.code === "NativeUnavailable") {
		toast.error("Saving files doesn't work on this device yet");

		return;
	}

	if (error.code === "DevicePermissionDenied") {
		toast.error(`Colibri can't save the ${NOUNS[group]} to your photos`, {
			description:
				"Turn on photo access for Colibri in the Settings app, then try again.",
		});

		return;
	}

	toast.error(`Couldn't save the ${NOUNS[group]}`, {
		description: "Give it another try.",
	});
};

const downloadNative = async (target: MediaTarget, url: string) => {
	const { invoke } = await import("@tauri-apps/api/core");

	try {
		const saved = await invoke<SavedFile | null>(SAVE_COMMAND, {
			url,
			name: nativeFileName(target),
			type: target.mimeType,
		});

		if (!saved) return;

		toast.success(savedMessage(saved));
	} catch (thrown) {
		nativeFailure(groupOf(target.mimeType), thrown);
	}
};

export const downloadMedia = async (target: MediaTarget) => {
	const url = isNativeShell() ? webUrlOf(target.src) : undefined;

	if (url) {
		await downloadNative(target, url);

		return;
	}

	let blob: Blob;

	try {
		blob = await fetchMedia(target.src, target.mimeType);
	} catch (thrown) {
		failure("download", groupOf(target.mimeType), thrown);

		return;
	}

	const name = mediaFileName(target, blob.type || target.mimeType);

	saveInBrowser(blob, name);
	toast.success(`Downloaded ${name}`);
};

export const canOpenInPlayer = () => {
	return isLinuxApp(
		typeof navigator === "undefined" ? undefined : navigator.userAgent,
		isNativeShell(),
	);
};

export const openMediaInPlayer = async (
	target: MediaTarget,
	progress: (fraction: number | undefined) => void,
) => {
	const url = webUrlOf(target.src);

	if (!url) return;

	const { Channel, invoke } = await import("@tauri-apps/api/core");
	const onProgress = new Channel<DownloadProgress>();

	onProgress.onmessage = ({ received, total }) =>
		progress(total ? Math.min(1, received / total) : undefined);

	try {
		await invoke(PLAYER_COMMAND, {
			url,
			name: nativeFileName(target),
			type: target.mimeType,
			onProgress,
		});
	} catch (thrown) {
		const error = classifyNativeError(thrown, PLAYER_COMMAND);

		log.warn("media.open_player failed", { code: error.code });

		toast.error("Couldn't open the video", {
			description: "Download it instead, then open it from your files.",
		});
	}
};

export const downloadImage = (target: ImageTarget) => {
	return downloadMedia(target);
};

export const imageTargetOf = (
	element: Element | null,
): ImageTarget | undefined => {
	const host = element?.closest<HTMLElement>("[data-image-src]");
	const src = host?.dataset.imageSrc;

	if (!src) return undefined;

	return { src, name: host?.dataset.imageName || undefined };
};

export const lightboxImageActions = (
	items: () => readonly {
		src: string;
		downloadHref?: string;
		name?: string;
		kind?: string;
		mimeType?: string;
	}[],
) => ({
	onCopyImage: (index: number) => {
		const item = items()[index];

		if (!item || item.kind === "video") return;

		void copyImage({ src: item.downloadHref ?? item.src, name: item.name });
	},
	onDownloadImage: (index: number) => {
		const item = items()[index];

		if (!item || item.kind === "video") return;

		void downloadImage({ src: item.downloadHref ?? item.src, name: item.name });
	},
	onDownload: (index: number) => {
		const item = items()[index];

		if (!item) return;

		void downloadMedia({
			src: item.downloadHref ?? item.src,
			name: item.name,
			mimeType: item.mimeType,
		});
	},
});
