export type Hsv = { h: number; s: number; v: number };

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const DEFAULT_SWATCHES = [
	"#6d5ae6",
	"#e64980",
	"#ef4444",
	"#f59e0b",
	"#84cc16",
	"#10b981",
	"#06b6d4",
	"#6366f1",
	"#11111b",
	"#ffffff",
];

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const normalizeHex = (input: string): string | undefined => {
	const match = HEX_PATTERN.exec(input.trim());
	if (!match) return undefined;
	const digits = match[1].toLowerCase();
	const full =
		digits.length === 3
			? digits
					.split("")
					.map((digit) => digit + digit)
					.join("")
			: digits;
	return `#${full}`;
};

export const hexToRgb = (hex: string): [number, number, number] => {
	const normalized = normalizeHex(hex) ?? "#000000";
	const value = Number.parseInt(normalized.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const rgbToHex = (red: number, green: number, blue: number) =>
	`#${[red, green, blue]
		.map((channel) =>
			Math.round(clamp(channel, 0, 255))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;

export const hexToHsv = (hex: string): Hsv => {
	const [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255);
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;
	let hue = 0;
	if (delta > 0) {
		if (max === red) hue = ((green - blue) / delta) % 6;
		else if (max === green) hue = (blue - red) / delta + 2;
		else hue = (red - green) / delta + 4;
		hue *= 60;
		if (hue < 0) hue += 360;
	}
	return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
};

export const hsvToHex = ({ h, s, v }: Hsv) => {
	const hue = ((h % 360) + 360) % 360;
	const chroma = v * s;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = v - chroma;
	const sector = Math.floor(hue / 60);
	const [red, green, blue] = [
		[chroma, x, 0],
		[x, chroma, 0],
		[0, chroma, x],
		[0, x, chroma],
		[x, 0, chroma],
		[chroma, 0, x],
	][sector] ?? [0, 0, 0];
	return rgbToHex((red + m) * 255, (green + m) * 255, (blue + m) * 255);
};

const relativeLuminance = (hex: string) => {
	const [red, green, blue] = hexToRgb(hex).map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const isLightColor = (hex: string) => relativeLuminance(hex) > 0.179;
