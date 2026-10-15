import { classifyThrown, createLogger } from "@colibri-social/lib";
import { toast } from "@colibri-social/ui";
import { describeError } from "../../../data/error-copy";
import { isNativeShell } from "../../../shell/desktop/window-chrome";

const log = createLogger("image-actions");

export type ImageTarget = { src: string; name?: string };

const EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
};

const nativeFetch = async (src: string) => {
	const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
	return tauriFetch(src, { method: "GET" });
};

const fetchImage = async (src: string) => {
	const response = isNativeShell() ? await nativeFetch(src) : await fetch(src);
	if (!response.ok) throw new Error(`image request failed: ${response.status}`);
	const type = response.headers.get("content-type")?.split(";")[0]?.trim();
	const blob = await response.blob();
	return type && blob.type !== type ? new Blob([blob], { type }) : blob;
};

const isAndroid = () =>
	typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

type NativeFailure = { code?: string; message?: string };

const isNativeFailure = (value: unknown): value is NativeFailure =>
	typeof value === "object" && value !== null && "code" in value;

const saveNative = async (blob: Blob, name: string) => {
	const { invoke } = await import("@tauri-apps/api/core");
	const bytes = new Uint8Array(await blob.arrayBuffer());
	if (isAndroid())
		return invoke<string | null>("save_image", {
			name,
			type: blob.type || "image/png",
			bytes: Array.from(bytes),
		});
	return invoke<string | null>("save_image", bytes, {
		headers: {
			"x-colibri-file-name": encodeURIComponent(name),
			"x-colibri-file-type": blob.type || "image/png",
		},
	});
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

export const imageFileName = (target: ImageTarget, type?: string) => {
	const named = target.name?.trim();
	if (named) return named;
	const fromUrl = (() => {
		try {
			const segment = new URL(target.src, location.href).pathname
				.split("/")
				.filter(Boolean)
				.at(-1);
			return segment && /\.[a-z0-9]{2,5}$/i.test(segment) ? segment : undefined;
		} catch {
			return undefined;
		}
	})();
	if (fromUrl) return decodeURIComponent(fromUrl);
	return `image-${Date.now()}.${EXTENSIONS[type ?? ""] ?? "png"}`;
};

type ImageAction = "copy" | "download";

const BLOCKED_COPY: Record<
	ImageAction,
	{ title: string; description: string }
> = {
	copy: {
		title: "This image can't be copied yet",
		description:
			"Where it's stored doesn't let Colibri copy it so far. You can still open it in full size.",
	},
	download: {
		title: "This image can't be downloaded yet",
		description:
			"Where it's stored doesn't let Colibri save it so far. You can still open it in full size.",
	},
};

const isBlocked = (thrown: unknown) => {
	if (typeof navigator !== "undefined" && navigator.onLine === false)
		return false;
	if (thrown instanceof TypeError) return true;
	if (typeof thrown === "string" && /scope|not allowed/i.test(thrown))
		return true;
	return thrown instanceof DOMException && thrown.name === "SecurityError";
};

const failure = (action: ImageAction, thrown: unknown) => {
	const method = `image.${action}`;
	if (isBlocked(thrown)) {
		log.warn(`${method} blocked`, { reason: "cross-origin" });
		const copy = BLOCKED_COPY[action];
		toast.error(copy.title, { description: copy.description });
		return;
	}
	const error = classifyThrown(thrown, { method });
	log.warn(`${method} failed`, { code: error.code });
	const copy = describeError(error);
	toast.error(
		action === "copy"
			? "Couldn't copy the image"
			: "Couldn't download the image",
		{ description: copy.description ?? "Give it another try." },
	);
};

export const copyImage = async (target: ImageTarget) => {
	try {
		const png = fetchImage(target.src).then(toPng);
		await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
		toast.success("Image copied");
	} catch (thrown) {
		failure("copy", thrown);
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

export const downloadImage = async (target: ImageTarget) => {
	let blob: Blob;
	try {
		blob = await fetchImage(target.src);
	} catch (thrown) {
		failure("download", thrown);
		return;
	}
	const name = imageFileName(target, blob.type);
	if (!isNativeShell()) {
		saveInBrowser(blob, name);
		toast.success(`Downloaded ${name}`);
		return;
	}
	try {
		const saved = await saveNative(blob, name);
		if (!saved) return;
		toast.success(
			isAndroid() ? `Saved ${saved} to Downloads` : `Saved ${saved}`,
		);
	} catch (thrown) {
		const code = isNativeFailure(thrown) ? thrown.code : undefined;
		log.warn("image.download failed", { code: code ?? "Failed" });
		if (code === "Cancelled") return;
		if (code === "Unsupported") {
			toast.error("Saving images doesn't work on this device yet");
			return;
		}
		toast.error("Couldn't save the image", {
			description: "Give it another try.",
		});
	}
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
});
