export type ImageCropShape = "avatar" | "banner" | "emoji";

export type Size = { width: number; height: number };

export type CropView = { zoom: number; x: number; y: number };

export type CropRect = { x: number; y: number; width: number; height: number };

export const CROP_ASPECT: Record<ImageCropShape, number> = {
	avatar: 1,
	banner: 3,
	emoji: 1,
};

export const CROP_OUTPUT: Record<ImageCropShape, Size> = {
	avatar: { width: 512, height: 512 },
	banner: { width: 1500, height: 500 },
	emoji: { width: 128, height: 128 },
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const MAX_WORKING_SIDE = 4096;
const RUBBER_BAND = 0.35;

export const coverScale = (image: Size, frame: Size) =>
	Math.max(frame.width / image.width, frame.height / image.height);

export const clampZoom = (zoom: number) =>
	Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const panLimits = (image: Size, frame: Size, zoom: number) => {
	const scale = coverScale(image, frame) * zoom;
	return {
		x: Math.max(0, (image.width * scale - frame.width) / 2),
		y: Math.max(0, (image.height * scale - frame.height) / 2),
	};
};

const clampAxis = (value: number, limit: number) =>
	Math.min(limit, Math.max(-limit, value)) + 0;

const bandAxis = (value: number, limit: number, span: number) => {
	const over = Math.abs(value) - limit;
	if (over <= 0) return value;
	const eased = (1 - 1 / ((over * RUBBER_BAND) / span + 1)) * span;
	return Math.sign(value) * (limit + eased);
};

export const clampView = (
	view: CropView,
	image: Size,
	frame: Size,
): CropView => {
	const zoom = clampZoom(view.zoom);
	const limits = panLimits(image, frame, zoom);
	return {
		zoom,
		x: clampAxis(view.x, limits.x),
		y: clampAxis(view.y, limits.y),
	};
};

export const bandView = (
	view: CropView,
	image: Size,
	frame: Size,
): CropView => {
	const zoom = clampZoom(view.zoom);
	const limits = panLimits(image, frame, zoom);
	return {
		zoom,
		x: bandAxis(view.x, limits.x, frame.width / 2),
		y: bandAxis(view.y, limits.y, frame.height / 2),
	};
};

export const zoomAround = (
	view: CropView,
	nextZoom: number,
	point: { x: number; y: number },
): CropView => {
	const zoom = clampZoom(nextZoom);
	const ratio = zoom / view.zoom;
	return {
		zoom,
		x: point.x - (point.x - view.x) * ratio,
		y: point.y - (point.y - view.y) * ratio,
	};
};

export const sourceRect = (
	view: CropView,
	image: Size,
	frame: Size,
): CropRect => {
	const scale = coverScale(image, frame) * view.zoom;
	const width = Math.min(image.width, frame.width / scale);
	const height = Math.min(image.height, frame.height / scale);
	const x = image.width / 2 - view.x / scale - width / 2;
	const y = image.height / 2 - view.y / scale - height / 2;
	return {
		x: Math.min(image.width - width, Math.max(0, x)),
		y: Math.min(image.height - height, Math.max(0, y)),
		width,
		height,
	};
};

export const fitFrame = (stage: Size, aspect: number, inset: number): Size => {
	const width = Math.max(
		1,
		Math.min(stage.width - inset * 2, (stage.height - inset * 2) * aspect),
	);
	return { width, height: width / aspect };
};

export const workingSize = (image: Size, max = MAX_WORKING_SIDE): Size => {
	const longest = Math.max(image.width, image.height);
	if (longest <= max) return image;
	const ratio = max / longest;
	return {
		width: Math.round(image.width * ratio),
		height: Math.round(image.height * ratio),
	};
};

const EXTENSIONS: Record<string, string> = {
	"image/webp": "webp",
	"image/png": "png",
};

export const CROP_FALLBACK_TYPE: Record<ImageCropShape, string> = {
	avatar: "image/jpeg",
	banner: "image/jpeg",
	emoji: "image/png",
};

export const outputName = (name: string, type: string) => {
	const base = name.replace(/\.[^./\\]+$/, "") || "image";
	return `${base}.${EXTENSIONS[type] ?? "jpg"}`;
};
