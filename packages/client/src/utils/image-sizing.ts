import { createSignal, type JSX } from "solid-js";

export type SizedImage = {
	url?: string;
	width?: number;
	height?: number;
};

export type ImageBounds = {
	fallbackRatio?: string;
	maxWidth?: number;
	maxHeight?: number;
};

const [decodedAspectRatios, setDecodedAspectRatios] = createSignal<
	ReadonlyMap<string, number>
>(new Map());

const knownAspectRatio = (url: string | undefined): string | undefined => {
	const ratio = url ? decodedAspectRatios().get(url) : undefined;
	return ratio ? `${ratio}` : undefined;
};

export const reservedAspectRatio = (
	source: SizedImage | undefined,
): string | undefined => {
	if (!source) return undefined;
	if (source.width && source.height)
		return `${source.width} / ${source.height}`;
	return knownAspectRatio(source.url);
};

export const rememberAspectRatio = (
	url: string | undefined,
	target: EventTarget | null,
): void => {
	if (!url || !(target instanceof HTMLImageElement)) return;
	if (!target.naturalWidth || !target.naturalHeight) return;

	const ratio = target.naturalWidth / target.naturalHeight;
	setDecodedAspectRatios((previous) => {
		if (previous.get(url) === ratio) return previous;
		return new Map(previous).set(url, ratio);
	});
};

export const parseAspectRatio = (
	ratio: string | undefined,
): number | undefined => {
	if (!ratio) return undefined;
	const [width, height] = ratio
		.split("/")
		.map((part) => Number.parseFloat(part.trim()));
	if (!Number.isFinite(width) || width <= 0) return undefined;
	if (height === undefined) return width;
	if (!Number.isFinite(height) || height <= 0) return undefined;
	return width / height;
};

const smallest = (
	candidates: Array<number | undefined>,
): number | undefined => {
	const known = candidates.filter(
		(candidate): candidate is number => !!candidate && candidate > 0,
	);
	return known.length ? Math.max(1, Math.floor(Math.min(...known))) : undefined;
};

export const constrainedImageStyle = (
	source: SizedImage | undefined,
	bounds: ImageBounds = {},
): JSX.CSSProperties => {
	const ratioText = reservedAspectRatio(source) ?? bounds.fallbackRatio;
	const ratio = parseAspectRatio(ratioText);
	const style: JSX.CSSProperties = {};

	const maxHeight = smallest([bounds.maxHeight, source?.height]);
	const maxWidth = smallest([
		bounds.maxWidth,
		source?.width,
		ratio && maxHeight ? maxHeight * ratio : undefined,
	]);

	if (ratioText) style["aspect-ratio"] = ratioText;
	if (maxWidth) style["max-width"] = `${maxWidth}px`;
	if (maxHeight) {
		style["max-height"] = `${maxHeight}px`;
		if (!maxWidth && !ratioText) style.width = "auto";
	}

	return style;
};
