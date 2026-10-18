export type MediaSize = { width: number; height: number };

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
	new Promise<MediaSize | undefined>((resolve) => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.onloadedmetadata = () =>
			resolve({ width: video.videoWidth, height: video.videoHeight });
		video.onerror = () => resolve(undefined);
		video.src = url;
	});

export const measureMedia = async (
	file: File,
	url: string,
	mimeType = file.type,
): Promise<MediaSize | undefined> => {
	const size = mimeType.startsWith("image/")
		? await measureImage(file)
		: mimeType.startsWith("video/")
			? await measureVideo(url)
			: undefined;
	return size && size.width > 0 && size.height > 0 ? size : undefined;
};
