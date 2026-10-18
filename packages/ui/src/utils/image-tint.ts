const SAMPLE_SIZE = 24;

const tintCache = new Map<string, Promise<string | undefined>>();

const loadImage = (url: string) =>
	new Promise<HTMLImageElement | undefined>((resolve) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.decoding = "async";
		image.onload = () => resolve(image);
		image.onerror = () => resolve(undefined);
		image.src = url;
	});

const averageColor = (image: HTMLImageElement) => {
	const canvas = document.createElement("canvas");
	canvas.width = SAMPLE_SIZE;
	canvas.height = SAMPLE_SIZE;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return undefined;
	context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
	const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
	let red = 0;
	let green = 0;
	let blue = 0;
	let weight = 0;
	for (let index = 0; index < data.length; index += 4) {
		const alpha = data[index + 3] / 255;
		red += data[index] * alpha;
		green += data[index + 1] * alpha;
		blue += data[index + 2] * alpha;
		weight += alpha;
	}
	if (weight === 0) return undefined;
	const channel = (value: number) => Math.round(value / weight);
	return `rgb(${channel(red)} ${channel(green)} ${channel(blue)})`;
};

export const getImageTint = (url: string): Promise<string | undefined> => {
	const cached = tintCache.get(url);
	if (cached) return cached;
	const pending = loadImage(url).then((image) => {
		if (!image) return undefined;
		try {
			return averageColor(image);
		} catch {
			return undefined;
		}
	});
	tintCache.set(url, pending);
	return pending;
};

export const tintGradient = (tint: string) =>
	`linear-gradient(160deg, color-mix(in oklab, ${tint} 55%, var(--background)), color-mix(in oklab, ${tint} 22%, var(--background)))`;
