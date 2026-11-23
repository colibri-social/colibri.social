import {
	filterEntriesForPlatform,
	type ReleaseNote,
	type ReleasePlatform,
} from "@colibri-social/lib";
import { RELEASE_NOTES } from "./release-notes/data";

type ReleaseNoteEntryView = {
	title: string;
	body: string;
	icon: string;
	kind: "feature" | "fix";
};

export type ReleaseNoteSummary = {
	version: string;
	date: string;
	title?: string;
	heroImage?: string;
	entries: ReleaseNoteEntryView[];
};

const FIRST_SPACES_RELEASE = [0, 7, 0];

export const PREVIEW_VERSION = "0.0.0-preview";

const versionParts = (version: string) => {
	return version
		.split("-")[0]
		.split(".")
		.map((part) => Number(part) || 0);
};

export const isSpacesRelease = (version: string) => {
	if (version === PREVIEW_VERSION) return true;

	const parts = versionParts(version);
	const index = FIRST_SPACES_RELEASE.findIndex(
		(part, position) => (parts[position] ?? 0) !== part,
	);

	if (index === -1) return true;

	return (parts[index] ?? 0) > FIRST_SPACES_RELEASE[index];
};

export const APP_RELEASE_NOTES: readonly ReleaseNote[] = RELEASE_NOTES.filter(
	(note) => isSpacesRelease(note.version),
);

const isNative = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const sniffReleasePlatform = (
	agent: string,
	touchPoints: number,
): ReleasePlatform => {
	if (/Android/.test(agent)) return "android";
	if (/iPhone|iPad|iPod/.test(agent)) return "ios";
	if (/Mac/.test(agent)) return touchPoints > 1 ? "ios" : "macos";
	if (/Windows/.test(agent)) return "windows";
	if (/Linux|X11/.test(agent)) return "linux";
	return "web";
};

export const currentReleasePlatform = (): ReleasePlatform =>
	isNative()
		? sniffReleasePlatform(navigator.userAgent, navigator.maxTouchPoints)
		: "web";

export const formatReleaseDate = (date: string, locale?: string) => {
	const parsed = new Date(`${date}T00:00:00`);
	return Number.isNaN(parsed.getTime())
		? date
		: parsed.toLocaleDateString(locale, {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
};

export const releaseNotesFor = (
	notes: readonly ReleaseNote[],
	platform: ReleasePlatform,
	locale?: string,
): ReleaseNoteSummary[] =>
	notes
		.map((note) => ({
			version: note.version,
			date: formatReleaseDate(note.date, locale),
			title: note.title,
			heroImage: note.heroImage,
			entries: filterEntriesForPlatform(note.entries, platform).map(
				(entry) => ({
					title: entry.title,
					body: entry.body,
					icon: entry.icon,
					kind: entry.kind,
				}),
			),
		}))
		.filter((note) => note.entries.length > 0);
