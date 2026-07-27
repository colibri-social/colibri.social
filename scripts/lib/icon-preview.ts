import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ICON_VIEWBOX, iconBody } from "./icons.ts";

const PREVIEW_PX = 32;
const CELL_WIDTH = 2;
const CHUNK_LIMIT = 4096;
const DEFAULT_COLOR = "#ffffff";
const ID_BASE = 0x00c900;
const PLACEHOLDER = "\u{10EEEE}";

type Rasterizer = (svg: string) => Buffer;

let rasterizer: Rasterizer | null | undefined;

const loadRasterizer = (): Rasterizer | null => {
	if (rasterizer !== undefined) return rasterizer;
	try {
		const { Resvg } = createRequire(import.meta.url)("@resvg/resvg-js");
		rasterizer = (svg: string) =>
			new Resvg(svg, { fitTo: { mode: "width", value: PREVIEW_PX } })
				.render()
				.asPng();
	} catch {
		rasterizer = null;
	}
	return rasterizer;
};

export interface PreviewSupport {
	enabled: boolean;
	reason: string;
}

export const previewSupport = (): PreviewSupport => {
	if (process.env.COLIBRI_NO_ICON_PREVIEW) {
		return { enabled: false, reason: "COLIBRI_NO_ICON_PREVIEW is set" };
	}
	if (process.argv.includes("--no-preview")) {
		return { enabled: false, reason: "--no-preview was passed" };
	}
	if (process.env.COLIBRI_ICON_PREVIEW === "force") {
		return { enabled: true, reason: "COLIBRI_ICON_PREVIEW=force" };
	}
	if (!process.stdout.isTTY) {
		return { enabled: false, reason: "stdout is not a terminal" };
	}

	const term = process.env.TERM ?? "";
	const program = process.env.TERM_PROGRAM ?? "";

	if (term === "xterm-ghostty" || program === "ghostty") {
		return { enabled: true, reason: "Ghostty" };
	}
	if (term === "xterm-kitty" || process.env.KITTY_WINDOW_ID) {
		return { enabled: true, reason: "Kitty" };
	}
	if (program === "WezTerm") {
		return { enabled: true, reason: "WezTerm" };
	}

	return {
		enabled: false,
		reason: `no known graphics support (TERM=${term || "unset"}, TERM_PROGRAM=${program || "unset"})`,
	};
};

export const supportsInlineImages = (): boolean => previewSupport().enabled;

const render = (name: string): Buffer | null => {
	const body = iconBody(name);
	if (!body) return null;

	const rasterize = loadRasterizer();
	if (!rasterize) return null;

	const color = process.env.COLIBRI_ICON_PREVIEW_COLOR ?? DEFAULT_COLOR;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON_VIEWBOX}" width="${PREVIEW_PX}" height="${PREVIEW_PX}">${body.replaceAll("currentColor", color)}</svg>`;

	try {
		return rasterize(svg);
	} catch {
		return null;
	}
};

const chunked = (keys: (more: number) => string, payload: string): string => {
	let out = "";
	for (let offset = 0; offset < payload.length; offset += CHUNK_LIMIT) {
		const chunk = payload.slice(offset, offset + CHUNK_LIMIT);
		const more = offset + CHUNK_LIMIT < payload.length ? 1 : 0;
		out += `\x1b_G${keys(more)};${chunk}\x1b\\`;
	}
	return out;
};

export const inlineImage = (name: string): string | null => {
	const png = render(name);
	if (!png) return null;

	return chunked(
		(more) => `a=T,f=100,c=${CELL_WIDTH},r=1,q=2,m=${more}`,
		png.toString("base64"),
	);
};

const ids = new Map<string, number>();
let nextId = ID_BASE;

const idColor = (id: number): string =>
	`\x1b[38;2;${(id >> 16) & 0xff};${(id >> 8) & 0xff};${id & 0xff}m`;

const placeholderRun = (id: number): string =>
	`${idColor(id)}${PLACEHOLDER.repeat(CELL_WIDTH)}\x1b[39m`;

const ensureTransmitted = (name: string): number | null => {
	const existing = ids.get(name);
	if (existing !== undefined) return existing;

	const png = render(name);
	if (!png) return null;

	const id = nextId++;

	const transmit = chunked(
		(more) => `a=t,i=${id},f=100,q=2,m=${more}`,
		png.toString("base64"),
	);
	const place = `\x1b_Ga=p,i=${id},U=1,c=${CELL_WIDTH},r=1,q=2\x1b\\`;

	process.stdout.write(`${transmit}${place}`);
	ids.set(name, id);
	return id;
};

export const iconLabel = (name: string, previews: boolean): string => {
	if (!previews) return name;
	const id = ensureTransmitted(name);
	return id === null ? name : `${placeholderRun(id)} ${name}`;
};

const main = () => {
	const names = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
	if (names.length === 0) {
		console.error("usage: icon-preview.ts <icon-name>...");
		process.exitCode = 1;
		return;
	}

	const support = previewSupport();
	console.log(
		support.enabled
			? `previews on (${support.reason})`
			: `previews off (${support.reason})`,
	);
	console.log(`rasterizer: ${loadRasterizer() ? "loaded" : "unavailable"}`);

	console.log("\nunicode placeholders, the mode the prompt uses:");
	for (const name of names) {
		console.log(`  ${iconLabel(name, support.enabled)}`);
	}

	console.log("\ndirect placement, for comparison only:");
	for (const name of names) {
		const image = support.enabled ? inlineImage(name) : null;
		console.log(`  ${image ? `${image} ` : ""}${name}`);
	}

	console.log(
		"\nThe first block is the one that matters. Direct placement cannot be used inside the prompt, because the layout library counts its escape bytes as visible width.",
	);
};

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
	main();
}
