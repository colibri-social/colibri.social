import type { AttachmentView } from "../types";
import { asUri } from "./refs";

export const avatarUrl = (seed: string) =>
	asUri(`https://picsum.photos/seed/${encodeURIComponent(seed)}/256`);

export const bannerUrl = (seed: string) =>
	asUri(`https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/400`);

export const photo = (
	seed: string,
	width: number,
	height: number,
	name?: string,
): AttachmentView => ({
	url: asUri(
		`https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`,
	),
	mimeType: "image/jpeg",
	name: name ?? `${seed}.jpg`,
	width,
	height,
	size: Math.round(width * height * 0.18),
});

const GIFS = {
	cat: { id: "JIX9t2j0ZTN9S", width: 480, height: 480 },
	dance: { id: "l0MYt5jPR6QX5pnqM", width: 480, height: 270 },
	wow: { id: "5VKbvrjxpVJCM", width: 400, height: 225 },
	thumbs: { id: "111ebonMs90YLu", width: 500, height: 281 },
	party: { id: "26tOZ42Mg6pbTUPHW", width: 480, height: 360 },
	bird: { id: "3o7TKSjRrfIPjeiVyM", width: 480, height: 270 },
} as const;

export type GifName = keyof typeof GIFS;

export const gif = (name: GifName): AttachmentView => {
	const entry = GIFS[name];
	return {
		url: asUri(`https://media.giphy.com/media/${entry.id}/giphy.gif`),
		mimeType: "image/gif",
		name: `${name}.gif`,
		width: entry.width,
		height: entry.height,
	};
};

export const video = (
	name = "ForBiggerBlazes",
	width = 1280,
	height = 720,
): AttachmentView => ({
	url: asUri(
		`https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`,
	),
	mimeType: "video/mp4",
	name: `${name}.mp4`,
	width,
	height,
	size: 2_498_125,
});

export const file = (
	name: string,
	mimeType: string,
	size: number,
	url: string,
): AttachmentView => ({ url: asUri(url), mimeType, name, size });

export const pdf = (name: string, size = 482_113) =>
	file(
		name,
		"application/pdf",
		size,
		"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
	);

export const zip = (name: string, size = 3_840_221) =>
	file(name, "application/zip", size, "https://example.com/files/assets.zip");

export const audio = (name: string, size = 5_120_440) =>
	file(
		name,
		"audio/mpeg",
		size,
		"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
	);
