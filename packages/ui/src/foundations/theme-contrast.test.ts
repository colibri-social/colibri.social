import { describe, expect, it } from "vitest";
import { readableUserColor } from "../utils/name-color";
import {
	COLOR_TOKENS,
	CONTRAST_PAIRS,
	composite,
	contrastBetween,
	PARITY_PAIRS,
	PARITY_TOLERANCE,
	pairRatio,
	parseColor,
	readThemes,
	SURFACES,
	THEMES,
} from "./theme-contrast";

type ReadFile = (path: URL, encoding: "utf8") => Promise<string>;

const fsModule: string = "node:fs/promises";
const { readFile } = (await import(fsModule)) as { readFile: ReadFile };

const themes = readThemes(
	await readFile(new URL("../styles/index.css", import.meta.url), "utf8"),
);

const USER_COLORS = [
	"#ffffff",
	"#000000",
	"#ffd857",
	"#4ade80",
	"#5cadff",
	"#8e51ff",
	"#ff575a",
	"#76c4e5",
	"#e870df",
	"#11111b",
	"#a1a1a1",
];

describe("parseColor", () => {
	it("reads hex, rgb and rgba notations", () => {
		expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
		expect(parseColor("#08080880")).toEqual([8, 8, 8, 128 / 255]);
		expect(parseColor("rgb(0 0 0 / 0.1)")).toEqual([0, 0, 0, 0.1]);
		expect(parseColor("rgba(255, 255, 255, 0.08)")).toEqual([
			255, 255, 255, 0.08,
		]);
		expect(parseColor("rgb(8, 8, 8)")).toEqual([8, 8, 8, 1]);
		expect(parseColor("rgb(100% 0% 0% / 50%)")).toEqual([255, 0, 0, 0.5]);
	});

	it("rejects values it cannot read", () => {
		expect(parseColor("var(--primary)")).toBeUndefined();
		expect(parseColor("#12345")).toBeUndefined();
		expect(parseColor("rebeccapurple")).toBeUndefined();
	});
});

describe("contrastBetween", () => {
	it("matches the WCAG reference values", () => {
		const white = parseColor("#ffffff");
		const black = parseColor("#000000");
		if (!white || !black) throw new Error("unreachable");
		expect(contrastBetween(white, black)).toBeCloseTo(21, 5);
		expect(contrastBetween(white, white)).toBeCloseTo(1, 5);
	});

	it("composites translucent layers before measuring", () => {
		const half = composite([0, 0, 0, 0.5], [255, 255, 255, 1]);
		expect(half[0]).toBeCloseTo(127.5, 5);
		expect(half[3]).toBe(1);
	});
});

describe("theme tokens", () => {
	it.each(THEMES)("defines every color token in the %s theme", (theme) => {
		for (const name of COLOR_TOKENS) {
			expect(themes[theme][name], `--${name}`).toBeDefined();
			expect(parseColor(themes[theme][name]), `--${name}`).toBeDefined();
		}
	});

	it("keeps non-color tokens out of the theme blocks", () => {
		for (const theme of THEMES) {
			expect(Object.keys(themes[theme]).sort()).toEqual(
				[...COLOR_TOKENS].sort(),
			);
		}
	});
});

describe.each(THEMES)("%s theme contrast", (theme) => {
	it.each(
		CONTRAST_PAIRS.map((pair) => [pair.id, pair] as const),
	)("%s", (_, pair) => {
		expect(pairRatio(themes[theme], pair)).toBeGreaterThanOrEqual(pair.minimum);
	});
});

describe("light elevation parity", () => {
	it.each(
		PARITY_PAIRS.map((pair) => [pair.id, pair] as const),
	)("%s steps at least as far as in dark", (_, pair) => {
		const dark = pairRatio(themes.dark, pair);
		const light = pairRatio(themes.light, pair);
		expect(light).toBeGreaterThan(1);
		expect(light).toBeGreaterThanOrEqual(dark * PARITY_TOLERANCE);
	});
});

describe.each(THEMES)("%s name colors", (theme) => {
	it.each(USER_COLORS)("keeps %s readable on every surface", (color) => {
		const readable = readableUserColor(color, theme);
		if (!readable) throw new Error(color);
		const tokens = { ...themes[theme], "name-color": readable };
		for (const surface of SURFACES) {
			expect(
				pairRatio(tokens, { foreground: "name-color", background: surface }),
				`${readable} on ${surface}`,
			).toBeGreaterThanOrEqual(4.5);
		}
	});
});
