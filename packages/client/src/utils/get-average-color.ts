/**
 * Gets the average color of an image
 * @param img The image to get the average color of
 * @param sampleSize The sample size. Smaller = faster
 * @returns The average color in RGB and Hex
 */
export const getAverageColor = (
	img: HTMLImageElement,
	sampleSize = 25,
): { r: number; g: number; b: number; hex: string } => {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("Could not get 2D canvas context");

	canvas.width = sampleSize;
	canvas.height = sampleSize;
	ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

	const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

	let r = 0,
		g = 0,
		b = 0;
	const pixelCount = data.length / 4;

	for (let i = 0; i < data.length; i += 4) {
		r += data[i];
		g += data[i + 1];
		b += data[i + 2];
	}

	r = Math.round(r / pixelCount);
	g = Math.round(g / pixelCount);
	b = Math.round(b / pixelCount);

	const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

	return { r, g, b, hex };
};

/**
 * Loads an image from a URL and computes its average color. Resolves to
 * `undefined` if the image fails to load or the canvas is tainted (e.g. the
 * source lacks CORS headers), so callers can fall back gracefully.
 * @param url The image URL to load
 * @param sampleSize The sample size. Smaller = faster
 * @returns The average color in RGB and Hex, or `undefined` on failure
 */
export const getAverageColorFromUrl = (
	url: string,
	sampleSize = 25,
): Promise<{ r: number; g: number; b: number; hex: string } | undefined> =>
	new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				resolve(getAverageColor(img, sampleSize));
			} catch {
				resolve(undefined);
			}
		};
		img.onerror = () => resolve(undefined);
		img.src = url;
	});
