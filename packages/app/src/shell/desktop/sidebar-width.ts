import {
	clampPaneWidth,
	clampSidebarWidth,
	MAX_THREAD_PANE_WIDTH,
	MIN_THREAD_PANE_WIDTH,
} from "@colibri-social/ui";
import { readStored, readStoredJSON, writeStored } from "../../data/persist";

export const SIDEBAR_WIDTH_KEY = "colibri:channel-list-width";
export const THREAD_WIDTH_KEY = "colibri:thread-pane-width";
const LEGACY_PREFERENCES_KEY = "colibri:user-preferences";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const legacyWidth = () => {
	const width = readStoredJSON(
		LEGACY_PREFERENCES_KEY,
		isRecord,
	)?.channelSidebarWidth;
	return typeof width === "number" ? width : undefined;
};

const storedNumber = (key: string) => {
	const raw = readStored(key);
	const value = raw === undefined ? Number.NaN : Number(raw);
	return Number.isFinite(value) ? value : undefined;
};

export const storedSidebarWidth = () =>
	clampSidebarWidth(storedNumber(SIDEBAR_WIDTH_KEY) ?? legacyWidth());

export const storeSidebarWidth = (width: number) =>
	writeStored(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));

const clampThreadWidth = (width: number) =>
	clampPaneWidth(width, MIN_THREAD_PANE_WIDTH, MAX_THREAD_PANE_WIDTH);

export const storedThreadWidth = () => {
	const stored = storedNumber(THREAD_WIDTH_KEY);
	return stored === undefined ? undefined : clampThreadWidth(stored);
};

export const storeThreadWidth = (width: number) =>
	writeStored(THREAD_WIDTH_KEY, String(clampThreadWidth(width)));
