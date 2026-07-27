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
