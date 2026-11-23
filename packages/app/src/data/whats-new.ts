import { readStored, readStoredJSON, writeStored } from "./persist";
import { LEGACY_PREFERENCES_KEY } from "./preferences/legacy";
import { PREVIEW_VERSION } from "./release-notes";

export const WHATS_NEW_SEEN_KEY = "colibri:whats-new-seen";

type LegacyPreferences = { lastSeenReleaseNote?: unknown };

const isLegacyPreferences = (value: unknown): value is LegacyPreferences => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const markReleaseNoteSeen = (version: string) => {
	writeStored(WHATS_NEW_SEEN_KEY, version);
};

export const pendingReleaseNote = <Note extends { version: string }>(
	newest: Note | undefined,
): Note | undefined => {
	if (!newest) return undefined;

	const seen = readStored(WHATS_NEW_SEEN_KEY);

	if (newest.version === PREVIEW_VERSION) {
		return seen === PREVIEW_VERSION ? undefined : newest;
	}

	if (seen !== undefined) return seen === newest.version ? undefined : newest;

	const legacy = readStoredJSON(LEGACY_PREFERENCES_KEY, isLegacyPreferences);

	if (!legacy) {
		markReleaseNoteSeen(newest.version);
		return undefined;
	}

	return legacy.lastSeenReleaseNote === newest.version ? undefined : newest;
};
