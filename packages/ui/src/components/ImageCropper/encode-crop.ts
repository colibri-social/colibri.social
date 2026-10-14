import { type CropRect, outputName, type Size, workingSize } from "./crop-math";

const QUALITIES = [0.9, 0.82, 0.72, 0.6, 0.48];

export const loadWorkingBitmap = async (file: File) => {
	const decoded = await createImageBitmap(file);
	const target = workingSize({
		width: decoded.width,
		height: decoded.height,
	});
	if (target.width === decoded.width && target.height === decoded.height) {
		return decoded;
	}
	const resized = await createImageBitmap(decoded, {
		resizeWidth: target.width,
		resizeHeight: target.height,
		resizeQuality: "high",
	});
	decoded.close();
	return resized;
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
	new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const drawCrop = (bitmap: ImageBitmap, rect: CropRect, output: Size) => {
	const canvas = document.createElement("canvas");
	canvas.width = output.width;
	canvas.height = output.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas is unavailable");
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(
		bitmap,
		rect.x,
		rect.y,
		rect.width,
		rect.height,
		0,
		0,
		output.width,
		output.height,
	);
	return canvas;
};

export const encodeCrop = async (options: {
	bitmap: ImageBitmap;
	rect: CropRect;
	output: Size;
	name: string;
	maxBytes?: number;
}): Promise<File> => {
	const canvas = drawCrop(options.bitmap, options.rect, options.output);
	let blob: Blob | null = null;
	for (const quality of QUALITIES) {
		blob = await toBlob(canvas, "image/webp", quality);
		if (blob?.type !== "image/webp") {
			blob = await toBlob(canvas, "image/jpeg", quality);
		}
		if (!blob) break;
		if (!options.maxBytes || blob.size <= options.maxBytes) break;
	}
	canvas.width = 0;
	canvas.height = 0;
	if (!blob) throw new Error("The image couldn't be encoded");
	return new File([blob], outputName(options.name, blob.type), {
		type: blob.type,
	});
};
