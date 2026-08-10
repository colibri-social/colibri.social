export const CHIP_AVATAR_CLASS =
	"inline-block size-[0.95em] rounded-[2px] align-[-0.15em] object-cover mr-0.5";

export const CHIP_INITIALS_CLASS =
	"inline-block size-[0.95em] rounded-[2px] align-[-0.15em] mr-0.5 text-[0.5em] leading-[1.9] text-center font-bold bg-foreground/15";

export const CHIP_GLYPH_CLASS =
	"inline-block size-[0.85em] align-[-0.08em] opacity-60 mr-0.5";

const SVG_NS = "http://www.w3.org/2000/svg";

const CARET_RIGHT_PATH =
	"m181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128L90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32";

export const caretRightSpec = () => [
	`${SVG_NS} svg`,
	{
		viewBox: "0 0 256 256",
		width: "1em",
		height: "1em",
		class: CHIP_GLYPH_CLASS,
	},
	[`${SVG_NS} path`, { fill: "currentColor", d: CARET_RIGHT_PATH }],
];
