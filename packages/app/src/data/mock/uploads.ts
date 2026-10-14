import { MAX_ATTACHMENT_BYTES, type UploadOptions } from "../source";
import type { AttachmentView } from "../types";
import { latencyScale } from "./latency";
import { asUri } from "./refs";

const measureImage = async (file: File) => {
	try {
		const bitmap = await createImageBitmap(file);
		const size = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		return size;
	} catch {
		return undefined;
	}
};

const measureVideo = (url: string) =>
	new Promise<{ width: number; height: number } | undefined>((resolve) => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.onloadedmetadata = () =>
			resolve({ width: video.videoWidth, height: video.videoHeight });
		video.onerror = () => resolve(undefined);
		video.src = url;
	});

export const mockUpload = (
	file: File,
	options: UploadOptions = {},
): Promise<AttachmentView> =>
	new Promise((resolve, reject) => {
		if (file.size > MAX_ATTACHMENT_BYTES) {
			reject(new Error(`"${file.name}" is too large to attach.`));
			return;
		}
		const fails = /fail/i.test(file.name);
		const duration = (1000 + Math.min(2000, file.size / 4000)) * latencyScale();
		const started = performance.now();
		let frame = 0;
		const finish = async () => {
			const url = URL.createObjectURL(file);
			const mimeType = file.type || "application/octet-stream";
			const size = mimeType.startsWith("image/")
				? await measureImage(file)
				: mimeType.startsWith("video/")
					? await measureVideo(url)
					: undefined;
			resolve({
				url: asUri(url),
				mimeType,
				name: file.name,
				size: file.size,
				...(size ?? {}),
			});
		};
		const tick = () => {
			if (options.signal?.aborted) {
				reject(new DOMException("Upload cancelled", "AbortError"));
				return;
			}
			const fraction = Math.min(1, (performance.now() - started) / duration);
			if (fails && fraction >= 0.6) {
				reject(new Error(`"${file.name}" couldn't be uploaded.`));
				return;
			}
			options.onProgress?.(fraction);
			if (fraction >= 1) {
				void finish();
				return;
			}
			frame = window.setTimeout(tick, 50);
		};
		options.signal?.addEventListener("abort", () => clearTimeout(frame));
		tick();
	});
