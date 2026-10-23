import type { PendingUpload } from "../../data/store";

export const PENDING_MEDIA_RELEASE_MS = 10_000;

const playsInline = (file: File) => file.type.startsWith("video/");

const stillPlaying = (url: string) => {
	if (typeof document === "undefined") return false;
	for (const video of document.querySelectorAll("video")) {
		if (video.currentSrc.startsWith(url)) return true;
		if (video.getAttribute("src")?.startsWith(url)) return true;
		for (const source of video.querySelectorAll("source"))
			if (source.getAttribute("src")?.startsWith(url)) return true;
	}
	return false;
};

export const createPendingMediaUrls = () => {
	const urls = new Map<File, string>();

	const urlFor = (upload: Pick<PendingUpload, "file" | "previewSrc">) => {
		if (!playsInline(upload.file)) return upload.previewSrc ?? "";
		const known = urls.get(upload.file);
		if (known) return known;
		const created = URL.createObjectURL(upload.file);
		urls.set(upload.file, created);
		return created;
	};

	const releasing = new Map<ReturnType<typeof setTimeout>, string>();

	const release = (url: string) => {
		const timer = setTimeout(() => {
			releasing.delete(timer);
			if (stillPlaying(url)) {
				release(url);
				return;
			}
			URL.revokeObjectURL(url);
		}, PENDING_MEDIA_RELEASE_MS);
		releasing.set(timer, url);
	};

	const keep = (files: ReadonlySet<File>) => {
		for (const [file, url] of urls) {
			if (files.has(file)) continue;
			urls.delete(file);
			release(url);
		}
	};

	const dispose = () => {
		for (const [timer, url] of releasing) {
			clearTimeout(timer);
			URL.revokeObjectURL(url);
		}
		releasing.clear();
		for (const url of urls.values()) URL.revokeObjectURL(url);
		urls.clear();
	};

	return { urlFor, keep, dispose };
};
