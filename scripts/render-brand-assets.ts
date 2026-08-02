import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Resvg } = require("@resvg/resvg-js") as {
	Resvg: new (
		svg: string,
		options: { fitTo: { mode: "width"; value: number } },
	) => { render: () => { asPng: () => Buffer } };
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = join(root, "packages", "assets", "brand");

const CANVAS = 1024;

const BIRD_BOUNDS = { x: 222.248, y: 42.971, width: 662.39, height: 946.163 };

const BIRD_RADIUS = 550.339;

const ADAPTIVE_DENSITIES = [
	["mdpi", 108],
	["hdpi", 162],
	["xhdpi", 216],
	["xxhdpi", 324],
	["xxxhdpi", 432],
] as const;

const ADAPTIVE_BACKGROUND = "#9d64fd";

const ADAPTIVE_SAFE_CIRCLE = 72 / 108;
const MASKABLE_SAFE_CIRCLE = 0.8;
const NOTIFICATION_GLYPH_FRACTION = 0.92;

type Fit =
	| { kind: "bounds"; fraction: number }
	| { kind: "circle"; diameter: number };

type Source = "background" | "background-rounded" | "no-background" | "dark";

const WINDOWS_ICO_SIZES = [16, 24, 32, 48, 64, 256];

const WINDOWS_SQUARE_LOGOS = [30, 44, 71, 89, 107, 142, 150, 284, 310];

const WINDOWS_STORE_LOGO = 50;

const read = (source: Source): string =>
	readFileSync(join(brandDir, `hummingbird-${source}.svg`), "utf8");

const uniquePaths = (svg: string): Array<string> => {
	const found = [...svg.matchAll(/<path d="([^"]*)"/g)].map((match) => match[1]);
	return [...new Set(found)];
};

const split = (svg: string) => {
	const open = svg.indexOf(">") + 1;
	const rectEnd = svg.indexOf("/>", svg.indexOf("<rect"));
	const defs = svg.indexOf("<defs>");
	const close = svg.lastIndexOf("</svg>");
	const hasRect = svg.includes("<rect");
	return {
		rect: hasRect ? svg.slice(open, rectEnd + 2) : "",
		bird: svg.slice(hasRect ? rectEnd + 2 : open, defs),
		defs: svg.slice(defs, close),
	};
};

const fitScale = (fit: Fit): number =>
	fit.kind === "circle"
		? ((CANVAS * fit.diameter) / 2) / BIRD_RADIUS
		: Math.min(
				(CANVAS * fit.fraction) / BIRD_BOUNDS.width,
				(CANVAS * fit.fraction) / BIRD_BOUNDS.height,
			);

const fitOffset = (scale: number) => ({
	x: CANVAS / 2 - scale * (BIRD_BOUNDS.x + BIRD_BOUNDS.width / 2),
	y: CANVAS / 2 - scale * (BIRD_BOUNDS.y + BIRD_BOUNDS.height / 2),
});

const fitTransform = (fit: Fit): string => {
	const scale = fitScale(fit);
	const { x, y } = fitOffset(scale);
	return `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})`;
};

const compose = (options: {
	source: Source;
	fit?: Fit;
	viewBox?: string;
	size?: number;
}): string => {
	const svg = read(options.source);
	const { rect, bird, defs } = split(svg);
	const body =
		options.fit === undefined
			? bird
			: `<g transform="${fitTransform(options.fit)}">${bird}</g>`;
	const viewBox = options.viewBox ?? `0 0 ${CANVAS} ${CANVAS}`;
	const size = options.size ?? CANVAS;
	return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${rect}${body}${defs}</svg>\n`;
};

const png = (svg: string, size: number): Buffer =>
	new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

const write = (relative: string, data: Buffer | string): void => {
	const target = join(root, relative);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, data);
	console.log(`wrote ${relative}`);
};

const ico = (entries: Array<{ size: number; data: Buffer }>): Buffer => {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(entries.length, 4);

	let offset = header.length + entries.length * 16;
	const directory: Array<Buffer> = [];
	for (const entry of entries) {
		const record = Buffer.alloc(16);
		record.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
		record.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
		record.writeUInt8(0, 2);
		record.writeUInt8(0, 3);
		record.writeUInt16LE(1, 4);
		record.writeUInt16LE(32, 6);
		record.writeUInt32LE(entry.data.length, 8);
		record.writeUInt32LE(offset, 12);
		directory.push(record);
		offset += entry.data.length;
	}

	return Buffer.concat([
		header,
		...directory,
		...entries.map((entry) => entry.data),
	]);
};

const vectorDrawable = (options: {
	dp: number;
	fit: Fit;
	paths: Array<string>;
}): string => {
	const scale = fitScale(options.fit);
	const { x: translateX, y: translateY } = fitOffset(scale);
	const paths = options.paths
		.map(
			(data) =>
				`        <path\n            android:fillColor="#FFFFFF"\n            android:pathData="${data}" />`,
		)
		.join("\n");

	return `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${options.dp}dp"
    android:height="${options.dp}dp"
    android:viewportWidth="${CANVAS}"
    android:viewportHeight="${CANVAS}">
    <group
        android:scaleX="${scale.toFixed(6)}"
        android:scaleY="${scale.toFixed(6)}"
        android:translateX="${translateX.toFixed(3)}"
        android:translateY="${translateY.toFixed(3)}">
${paths}
    </group>
</vector>
`;
};

const withMonochrome = (relative: string): void => {
	const target = join(root, relative);
	const current = readFileSync(target, "utf8");
	if (current.includes("<monochrome")) return;
	const next = current.replace(
		/(\n?)(\s*)<\/adaptive-icon>/,
		'$1$2  <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n$2</adaptive-icon>',
	);
	writeFileSync(target, next);
	console.log(`patched ${relative}`);
};

const renderWeb = (): void => {
	const tile = compose({ source: "background" });
	const maskable = compose({
		source: "background",
		fit: { kind: "circle", diameter: MASKABLE_SAFE_CIRCLE },
	});
	const bird = compose({ source: "no-background" });

	write("packages/wrapper/src-tauri/icons/icon.png", png(tile, CANVAS));

	const logo = png(bird, CANVAS);
	write("packages/assets/files/logo.png", logo);
	write("apps/website/src/assets/logo.png", logo);

	write("packages/assets/files/favicon.svg", tile);
	write(
		"packages/assets/files/login/colibri.svg",
		compose({
			source: "no-background",
			viewBox: `0 0 ${CANVAS} ${CANVAS}`,
			size: 64,
		}),
	);

	write("apps/website/public/favicon-96x96.png", png(tile, 96));
	write("apps/website/public/apple-touch-icon.png", png(tile, 180));
	write("apps/website/public/web-app-manifest-192x192.png", png(maskable, 192));
	write("apps/website/public/web-app-manifest-512x512.png", png(maskable, 512));
	write(
		"apps/website/public/favicon.ico",
		ico(
			[16, 32, 48].map((size) => ({ size, data: png(tile, size) })),
		),
	);
};

const renderWindows = (): void => {
	const tile = compose({ source: "background-rounded" });
	const icons = "packages/wrapper/src-tauri/icons";

	write(
		`${icons}/icon.ico`,
		ico(
			WINDOWS_ICO_SIZES.map((size) => ({ size, data: png(tile, size) })),
		),
	);

	for (const size of WINDOWS_SQUARE_LOGOS) {
		write(`${icons}/Square${size}x${size}Logo.png`, png(tile, size));
	}

	write(`${icons}/StoreLogo.png`, png(tile, WINDOWS_STORE_LOGO));
};

const renderAndroid = (): void => {
	const bird = read("no-background");
	const paths = uniquePaths(bird);
	const foreground = compose({
		source: "no-background",
		fit: { kind: "circle", diameter: ADAPTIVE_SAFE_CIRCLE },
	});

	for (const [density, size] of ADAPTIVE_DENSITIES) {
		const data = png(foreground, size);
		write(
			`packages/wrapper/src-tauri/icons/android/mipmap-${density}/ic_launcher_foreground.png`,
			data,
		);
		write(
			`packages/wrapper/src-tauri/gen/android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
			data,
		);
	}

	write(
		"packages/wrapper/src-tauri/gen/android/app/src/main/res/drawable/ic_launcher_monochrome.xml",
		vectorDrawable({
			dp: 108,
			fit: { kind: "circle", diameter: ADAPTIVE_SAFE_CIRCLE },
			paths,
		}),
	);
	write(
		"packages/wrapper/src-tauri/gen/android/app/src/main/res/drawable/ic_notification.xml",
		vectorDrawable({
			dp: 24,
			fit: { kind: "bounds", fraction: NOTIFICATION_GLYPH_FRACTION },
			paths,
		}),
	);

	const background = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">${ADAPTIVE_BACKGROUND}</color>
</resources>
`;
	write(
		"packages/wrapper/src-tauri/icons/android/values/ic_launcher_background.xml",
		background,
	);
	write(
		"packages/wrapper/src-tauri/gen/android/app/src/main/res/values/ic_launcher_background.xml",
		background,
	);

	for (const relative of [
		"packages/wrapper/src-tauri/icons/android/mipmap-anydpi-v26/ic_launcher.xml",
		"packages/wrapper/src-tauri/gen/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
		"packages/wrapper/src-tauri/gen/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",
	]) {
		withMonochrome(relative);
	}
};

const mode = process.argv[2] ?? "web";
if (mode === "android") renderAndroid();
else if (mode === "windows") renderWindows();
else if (mode === "web") renderWeb();
else if (mode === "all") {
	renderWeb();
	renderAndroid();
	renderWindows();
} else {
	console.error(
		`unknown mode "${mode}", expected web, android, windows or all`,
	);
	process.exit(1);
}
