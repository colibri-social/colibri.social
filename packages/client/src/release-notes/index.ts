import { filterEntriesForPlatform } from "@colibri-social/lib";
import { currentReleasePlatform } from "../utils/platform";
import type { ClientReleaseNote } from "./data";
import { RELEASE_NOTES } from "./data";

export type { ClientReleaseNote } from "./data";
export { RELEASE_NOTES } from "./data";
export type { ReleaseNoteIcon } from "./icons";
export { FALLBACK_RELEASE_NOTE_ICON, RELEASE_NOTE_ICONS } from "./icons";

export const newestReleaseNote = (): ClientReleaseNote | undefined =>
	RELEASE_NOTES[0];

export const newestReleaseNoteVersion = (): string | null =>
	RELEASE_NOTES[0]?.version ?? null;

export const visibleReleaseNotes = (): Array<ClientReleaseNote> => {
	const platform = currentReleasePlatform();

	return RELEASE_NOTES.map((note) => ({
		...note,
		entries: filterEntriesForPlatform(note.entries, platform),
	})).filter((note) => note.entries.length > 0);
};

export const newestVisibleReleaseNote = (): ClientReleaseNote | undefined =>
	visibleReleaseNotes()[0];

export const newestVisibleReleaseNoteVersion = (): string | null =>
	visibleReleaseNotes()[0]?.version ?? null;
