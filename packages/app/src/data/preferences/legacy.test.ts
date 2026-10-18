import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	importLegacyPreferences,
	LEGACY_PREFERENCES_KEY,
	legacyChange,
	legacyImportMarker,
} from "./legacy";
import { DEFAULT_PREFERENCES, type Preferences } from "./types";

const VIEWER = "did:plc:viewer";
const GIF = {
	id: "gif-1",
	url: "https://gif.test/1.gif",
	previewUrl: "https://gif.test/1.webp",
	width: 200,
	height: 100,
};

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
	...DEFAULT_PREFERENCES,
	...overrides,
});

const BLOB = {
	theme: "light",
	linkEmbedsByDefault: false,
	warnOnExternalLinks: false,
	preferredBlueskyClient: "mu",
	customBlueskyClientBase: "",
	experiments: { "light-mode-v1": true, "old-thing": false },
	controls: {
		swipeLeftAction: "reply",
		doubleTapEnabled: true,
		doubleTapAction: "react",
		doubleTapReactionEmoji: "🔥",
	},
	voice: {
		confirmVoiceJoin: true,
		showNonVideoParticipants: false,
		showOwnCamera: true,
		input: { volume: 0.5 },
	},
	emojiUsage: {
		"🦜": { count: 4, lastUsed: 1_700_000_000_000 },
		broken: { count: "many" },
	},
	recentGifs: [GIF, { id: "half" }],
	nativeNotifications: true,
};

const storage = new Map<string, string>();

beforeEach(() => {
	storage.clear();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("legacyChange", () => {
	it("maps the old blob onto synced client preferences and composer state", () => {
		expect(legacyChange(BLOB, prefs())).toEqual({
			client: {
				theme: "light",
				linkEmbedsByDefault: false,
				warnOnExternalLinks: false,
				blueskyClient: "mu",
				experiments: ["light-mode-v1"],
				controls: {
					swipeLeftAction: "reply",
					doubleTapEnabled: true,
					doubleTapAction: "react",
					doubleTapReactionEmoji: "🔥",
				},
				voiceView: {
					confirmJoin: true,
					showNonVideoParticipants: false,
					showOwnCamera: true,
				},
			},
			composer: {
				emojiUsage: { "🦜": { count: 4, lastUsed: 1_700_000_000_000 } },
				skinTone: 0,
				recentGifs: [GIF],
			},
		});
	});

	it("never overwrites what the server already holds", () => {
		const change = legacyChange(
			BLOB,
			prefs({
				client: {
					theme: "dark",
					controls: { swipeLeftAction: "members" },
				},
				composer: {
					emojiUsage: { "👍": { count: 1, lastUsed: 1 } },
					skinTone: 2,
					recentGifs: [],
				},
			}),
		);
		expect(change?.client?.theme).toBe("dark");
		expect(change?.client?.controls).toMatchObject({
			swipeLeftAction: "members",
			doubleTapEnabled: true,
		});
		expect(change?.composer).toEqual({
			emojiUsage: { "👍": { count: 1, lastUsed: 1 } },
			skinTone: 2,
			recentGifs: [GIF],
		});
	});

	it("returns nothing for a blob without synced settings", () => {
		expect(legacyChange({ nativeNotifications: true }, prefs())).toBe(
			undefined,
		);
		expect(legacyChange("nope", prefs())).toBe(undefined);
	});
});

describe("importLegacyPreferences", () => {
	const store = (ok = true) => ({
		preferences: () => prefs(),
		importSettings: vi.fn(async () => ok),
	});

	it("imports once per account", async () => {
		storage.set(LEGACY_PREFERENCES_KEY, JSON.stringify(BLOB));
		const target = store();
		await importLegacyPreferences(target, VIEWER);
		await importLegacyPreferences(target, VIEWER);
		expect(target.importSettings).toHaveBeenCalledOnce();
		expect(storage.get(legacyImportMarker(VIEWER))).toBe("1");
	});

	it("tries again after a failed write", async () => {
		storage.set(LEGACY_PREFERENCES_KEY, JSON.stringify(BLOB));
		const target = store(false);
		await importLegacyPreferences(target, VIEWER);
		expect(storage.has(legacyImportMarker(VIEWER))).toBe(false);
	});

	it("marks the import done when there is no old blob", async () => {
		const target = store();
		await importLegacyPreferences(target, VIEWER);
		expect(target.importSettings).not.toHaveBeenCalled();
		expect(storage.get(legacyImportMarker(VIEWER))).toBe("1");
	});
});
