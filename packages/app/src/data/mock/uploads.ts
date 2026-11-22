import { measureMedia } from "../media-size";
import { MAX_ATTACHMENT_BYTES, type UploadOptions } from "../source";
import type { AttachmentView } from "../types";
import { latencyScale } from "./latency";
import { asUri } from "./refs";

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
			const size = await measureMedia(file, url, mimeType);
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
