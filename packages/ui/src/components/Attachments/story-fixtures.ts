import { paintImage } from "../Banner/story-images";
import type { MediaItem } from "./MediaGrid";

const PALETTES: [string, string][] = [
	["#8e51ff", "#2d1b69"],
	["#2dd4bf", "#134e4a"],
	["#fbbf24", "#9a3412"],
	["#f472b6", "#581c87"],
	["#60a5fa", "#1e3a8a"],
	["#a3e635", "#14532d"],
	["#fb7185", "#7f1d1d"],
	["#c4b5fd", "#312e81"],
];

export const fixtureImage = (
	index: number,
	width: number,
	height: number,
	extra: Partial<MediaItem> = {},
): MediaItem => {
	const scale = 480 / Math.max(width, height);
	return {
		src: paintImage(
			Math.round(width * scale),
			Math.round(height * scale),
			PALETTES[index % PALETTES.length] as [string, string],
		),
		width,
		height,
		alt: `Example photo ${index + 1}`,
		name: `photo-${index + 1}.png`,
		...extra,
	};
};

export const fixtureImages = (count: number) =>
	Array.from({ length: count }, (_, index) =>
		fixtureImage(
			index,
			index % 3 === 1 ? 900 : 1600,
			index % 3 === 1 ? 1200 : 1000,
		),
	);
