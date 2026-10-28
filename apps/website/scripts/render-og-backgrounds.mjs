import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 1200;
const H = 630;
const root = fileURLToPath(new URL("../src/assets/", import.meta.url));

const MW = [
	[0, "rgb(132,74,32)", 1],
	[7.39, "rgb(134,75,60)", 1],
	[14.78, "rgb(135,76,88)", 1],
	[29.57, "rgb(137,77,143)", 1],
	[44.35, "rgb(140,79,199)", 1],
	[59.14, "rgb(142,81,255)", 1],
	[69.95, "rgb(118,63,220)", 1],
	[80.77, "rgb(94,46,186)", 1],
	[90.39, "rgb(63,23,141)", 1],
	[95.19, "rgb(47,11,118)", 1],
	[100, "rgb(32,0,96)", 1],
];

const MW_GLOW = [
	[0, "rgb(213,115,45)", 1],
	[7.39, "rgb(204,111,71)", 0.9375],
	[14.78, "rgb(195,107,98)", 0.875],
	[29.57, "rgb(178,98,150)", 0.75],
	[44.35, "rgb(160,90,203)", 0.625],
	[59.14, "rgb(142,81,255)", 0.5],
	[79.57, "rgb(88,41,175)", 0.25],
	[100, "rgb(34,0,96)", 0],
];

const stops = (list) =>
	list
		.map(
			([offset, color, opacity]) =>
				`<stop offset="${offset}%" stop-color="${color}" stop-opacity="${opacity}"/>`,
		)
		.join("");

const ellipse = (id, list, cx, cy, rx, ry) =>
	`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${ry}" gradientTransform="translate(${cx} ${cy}) scale(${rx / ry} 1) translate(${-cx} ${-cy})">${stops(list)}</radialGradient>`;

const svg = (width, height, defs, body) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${defs}</defs>${body}</svg>`,
	);

const heroSky = async (width, height, file) => {
	const cx = width / 2;
	const base = svg(
		width,
		height,
		ellipse("g", MW, cx, height, width * 1.82, height),
		`<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="#000" fill-opacity="0.1"/>`,
	);
	const glow = svg(
		width,
		height,
		ellipse("g", MW_GLOW, cx, height, width * 1.82, height),
		`<rect width="100%" height="100%" fill="#d9d9d9"/><rect width="100%" height="100%" fill="url(#g)"/>`,
	);
	const mask = await sharp(`${root}landing/milkyway-wide.webp`)
		.resize(width, height, { fit: "cover", position: "centre" })
		.ensureAlpha()
		.raw()
		.toBuffer();
	const glowPixels = await sharp(glow).removeAlpha().raw().toBuffer();
	const rgba = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		rgba[i * 4] = glowPixels[i * 3];
		rgba[i * 4 + 1] = glowPixels[i * 3 + 1];
		rgba[i * 4 + 2] = glowPixels[i * 3 + 2];
		rgba[i * 4 + 3] = mask[i * 4 + 3];
	}
	const maskedGlow = await sharp(rgba, { raw: { width, height, channels: 4 } })
		.png()
		.toBuffer();
	await sharp(base)
		.composite([{ input: maskedGlow }])
		.jpeg({ quality: 88 })
		.toFile(`${root}og/${file}`);
};

const starGlow = async () => {
	const tile = await sharp(`${root}landing/stars.webp`)
		.resize(512, 512)
		.png()
		.toBuffer();
	const tiles = [];
	for (let y = 0; y < H; y += 512) {
		for (let x = 0; x < W; x += 512)
			tiles.push({ input: tile, left: x, top: y });
	}
	const glows = svg(
		W,
		H,
		ellipse(
			"p",
			[
				[0, "rgb(142,81,255)", 0.5],
				[70, "rgb(142,81,255)", 0],
			],
			W * 0.2,
			H * 1.1,
			W * 0.9,
			H * 0.6,
		) +
			ellipse(
				"o",
				[
					[0, "rgb(213,115,45)", 0.45],
					[70, "rgb(213,115,45)", 0],
				],
				W * 0.1,
				H * 1.05,
				W * 0.4,
				H * 0.4,
			),
		`<rect width="100%" height="100%" fill="url(#p)"/><rect width="100%" height="100%" fill="url(#o)"/>`,
	);
	await sharp({
		create: { width: W, height: H, channels: 3, background: "#080808" },
	})
		.composite([...tiles, { input: glows }])
		.jpeg({ quality: 88 })
		.toFile(`${root}og/star-glow.jpg`);
};

const banner = async () => {
	const width = W;
	const height = 250;
	await sharp(
		svg(
			width,
			height,
			ellipse("g", MW, width / 2, height, width * 1.82, height),
			`<rect width="100%" height="100%" fill="#171717"/><rect width="100%" height="100%" fill="url(#g)"/>`,
		),
	)
		.jpeg({ quality: 90 })
		.toFile(`${root}og/banner.jpg`);
};

const homeBackground = async () => {
	const left = 105;
	const top = 250;
	const mockWidth = 990;
	const mock = await sharp(`${root}landing/app-mock.png`)
		.resize(mockWidth)
		.toBuffer({ resolveWithObject: true });
	const visible = await sharp(mock.data)
		.extract({
			left: 0,
			top: 0,
			width: mockWidth,
			height: Math.min(mock.info.height, H - top),
		})
		.toBuffer();
	await sharp(`${root}og/hero-sky.jpg`)
		.composite([{ input: visible, left, top }])
		.jpeg({ quality: 90 })
		.toFile(`${root}og/home.jpg`);
};

await heroSky(W, H, "hero-sky.jpg");
await starGlow();
await banner();
await homeBackground();

for (const name of ["doge", "grin"]) {
	await sharp(`${root}landing/${name}.webp`)
		.resize(160, 160, { fit: "contain", background: "#0000" })
		.png()
		.toFile(`${root}og/${name}.png`);
}

await sharp(`${root}landing/hummingbird.svg`, { density: 600 })
	.resize(124, 176, { fit: "contain", background: "#0000" })
	.png()
	.toFile(`${root}og/hummingbird.png`);
