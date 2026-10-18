import {
	filterEntriesForPlatform,
	type ReleaseNote,
	type ReleasePlatform,
} from "@colibri-social/lib";

export type ReleaseNoteEntryView = {
	title: string;
	body: string;
	kind: "feature" | "fix";
};

export type ReleaseNoteSummary = {
	version: string;
	date: string;
	title?: string;
	heroImage?: string;
	entries: ReleaseNoteEntryView[];
};

export const APP_RELEASE_NOTES: readonly ReleaseNote[] = [];

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
					kind: entry.kind,
				}),
			),
		}))
		.filter((note) => note.entries.length > 0);
