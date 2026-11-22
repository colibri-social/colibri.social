import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const TILE = 512;
const MIN_LUMINANCE = 150;
const MAX_STARS = 260;
const root = fileURLToPath(new URL("../src/assets/landing/", import.meta.url));

const { data } = await sharp(`${root}stars.webp`)
	.resize(TILE, TILE)
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });

const luminance = (x, y) => {
	const i = (y * TILE + x) * 4;

	return (
		(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) *
		(data[i + 3] / 255)
	);
};

const isPeak = (x, y, l) => {
	for (let dy = -2; dy <= 2; dy++) {
		for (let dx = -2; dx <= 2; dx++) {
			if ((dx || dy) && luminance(x + dx, y + dy) > l) return false;
		}
	}

	return true;
};

const found = [];

for (let y = 2; y < TILE - 2; y++) {
	for (let x = 2; x < TILE - 2; x++) {
		const l = luminance(x, y);

		if (l >= MIN_LUMINANCE && isPeak(x, y, l))
			found.push([x, y, Math.round(l)]);
	}
}

found.sort((a, b) => b[2] - a[2]);

await writeFile(
	`${root}stars-peaks.json`,
	`${JSON.stringify(found.slice(0, MAX_STARS))}\n`,
);
