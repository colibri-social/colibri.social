import { ColibriError } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REMOTE_CONTROLS } from "../remote/source";
import type { CommunityView, Did, GifView, SpaceRef } from "../types";
import { createMemoryPreferenceBackend } from "./memory";
import { orderCommunities } from "./order";
import { createPreferenceStore, preferencesSnapshotKey } from "./store";
import {
	DEFAULT_PREFERENCES,
	type PreferenceBackend,
	type Preferences,
} from "./types";
import { fromWire } from "./wire";

const VIEWER = "did:plc:viewer";
const KEY = preferencesSnapshotKey(VIEWER);
const SPACE = "did:plc:space" as Did;
const OTHER = "did:plc:other" as Did;
const CHANNEL =
	`at://${SPACE}/space/social.colibri.beta.channel.text/general` as SpaceRef;
const THREAD =
	`at://${SPACE}/space/social.colibri.beta.channel.thread/t1` as SpaceRef;
const GIF: GifView = {
	id: "gif-1",
	url: "https://gif.test/1.gif",
	previewUrl: "https://gif.test/1.webp",
	width: 200,
	height: 100,
};

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
	...DEFAULT_PREFERENCES,
	...overrides,
});

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

const create = (backend: PreferenceBackend, onScopesRejected?: () => void) =>
	createPreferenceStore({
		backend,
		controls: DEFAULT_REMOTE_CONTROLS,
		snapshotKey: KEY,
		onScopesRejected,
		composerWriteDelay: 20,
	});

describe("createPreferenceStore", () => {
	it("boots from the snapshot before the AppView answers", async () => {
		storage.set(
			KEY,
			JSON.stringify({
				preferences: prefs({
					notificationLevel: "nothing",
					client: { developerMode: true },
				}),
			}),
		);
		const load = deferred<Preferences>();
		const memory = createMemoryPreferenceBackend();
		const store = create({ ...memory.backend, load: () => load.promise });

		const refreshing = store.refresh();
		expect(store.notificationLevel()).toBe("nothing");
		expect(store.controls().developerMode).toBe(true);
		expect(store.controls().swipeLeftAction).toBe("members");

		load.resolve(prefs({ notificationLevel: "mentionsAndReplies" }));
		await refreshing;
		expect(store.notificationLevel()).toBe("mentionsAndReplies");
		expect(JSON.parse(storage.get(KEY) ?? "{}").preferences).toMatchObject({
			notificationLevel: "mentionsAndReplies",
		});
	});

	it("ignores a snapshot it cannot read", () => {
		storage.set(KEY, "{not json");
		const store = create(createMemoryPreferenceBackend().backend);
		expect(store.preferences()).toEqual(DEFAULT_PREFERENCES);
	});

	it("keeps controls across a reload", () => {
		const backend = createMemoryPreferenceBackend().backend;
		create(backend).setControls({ swipeLeftAction: "reply" });
		expect(create(backend).controls().swipeLeftAction).toBe("reply");
	});

	it("applies preferences from another session", () => {
		const store = create(createMemoryPreferenceBackend().backend);
		store.adopt(prefs({ communityOrder: [OTHER, SPACE], shareActivity: true }));
		expect(store.communityOrder()).toEqual([OTHER, SPACE]);
		expect(store.shareActivity()).toBe(true);
	});

	it("skips echoes while a write is in flight and takes the last output", async () => {
		const memory = createMemoryPreferenceBackend();
		const put = deferred<Preferences>();
		const store = create({
			...memory.backend,
			putSettings: () => put.promise,
		});

		void store.setNotificationLevel("nothing");
		store.adopt(prefs({ notificationLevel: "all" }));
		expect(store.notificationLevel()).toBe("nothing");

		put.resolve(prefs({ notificationLevel: "nothing", shareActivity: true }));
		await store.settled();
		expect(store.shareActivity()).toBe(true);

		store.adopt(prefs({ notificationLevel: "all" }));
		expect(store.notificationLevel()).toBe("all");
	});

	it("writes the whole settings record and pushes only the change", async () => {
		const putSettings = vi.fn(async () => prefs());
		const store = create({
			...createMemoryPreferenceBackend().backend,
			putSettings,
		});
		store.adopt(prefs({ communityOrder: [SPACE] }));

		await store.setGifFavorite(GIF, true);

		expect(putSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				notificationLevel: "all",
				communityOrder: [SPACE],
				shareActivity: false,
				gifFavorites: [GIF],
			}),
			{ gifFavorites: [GIF] },
		);
	});

	it("reloads the server state after a failed write", async () => {
		const memory = createMemoryPreferenceBackend({ shareActivity: false });
		const store = create({
			...memory.backend,
			putSettings: async () => {
				throw new ColibriError({ code: "Unexpected" });
			},
		});

		await store.setShareActivity(true);
		expect(store.shareActivity()).toBe(false);
	});

	it("asks for access again when a write is refused for scopes", async () => {
		const onScopesRejected = vi.fn();
		const store = create(
			{
				...createMemoryPreferenceBackend().backend,
				putSettings: async () => {
					throw new ColibriError({ code: "ScopesMissing" });
				},
			},
			onScopesRejected,
		);

		await store.setNotificationLevel("nothing");
		expect(onScopesRejected).toHaveBeenCalledOnce();
	});

	it("round trips a mute through a record and the full list", async () => {
		const memory = createMemoryPreferenceBackend({
			mutes: [
				{
					subject: { kind: "actor", did: OTHER },
					createdAt: "2026-10-01T00:00:00.000Z" as never,
				},
			],
		});
		const putMutes = vi.spyOn(memory.backend, "putMutes");
		const createMute = vi.spyOn(memory.backend, "createMute");
		const deleteMute = vi.spyOn(memory.backend, "deleteMute");
		const store = create(memory.backend);
		await store.refresh();

		await store.setMuted({ kind: "channel", channel: CHANNEL }, true);
		expect(store.isMuted({ kind: "channel", channel: CHANNEL })).toBe(true);
		expect(createMute).toHaveBeenCalledOnce();
		expect(putMutes.mock.lastCall?.[0].map((mute) => mute.subject)).toEqual([
			{ kind: "actor", did: OTHER },
			{ kind: "channel", channel: CHANNEL },
		]);
		const rkey = createMute.mock.lastCall?.[0];

		await store.setMuted({ kind: "channel", channel: CHANNEL }, false);
		expect(store.isMuted({ kind: "channel", channel: CHANNEL })).toBe(false);
		expect(deleteMute).toHaveBeenCalledWith(rkey);
		expect(memory.records().map((record) => record.key)).toEqual([
			`actor:${OTHER}`,
		]);
		expect(memory.state().mutes.map((mute) => mute.subject)).toEqual([
			{ kind: "actor", did: OTHER },
		]);

		await store.setMuted({ kind: "actor", did: OTHER }, false);
		expect(deleteMute).toHaveBeenLastCalledWith("seed0");
		expect(memory.state().mutes).toEqual([]);
	});

	it("keeps channel and thread mutes apart", async () => {
		const store = create(createMemoryPreferenceBackend().backend);
		await store.setMuted({ kind: "thread", thread: THREAD }, true);
		expect(store.isMuted({ kind: "thread", thread: THREAD })).toBe(true);
		expect(store.isMuted({ kind: "channel", channel: THREAD })).toBe(false);
	});

	it("serializes quick toggles", async () => {
		const memory = createMemoryPreferenceBackend();
		const store = create(memory.backend);
		const subject = { kind: "channel", channel: CHANNEL } as const;
		void store.setMuted(subject, true);
		void store.setMuted(subject, false);
		await store.setMuted(subject, true);
		await store.settled();
		expect(memory.records()).toHaveLength(1);
		expect(store.isMuted(subject)).toBe(true);
	});
});

describe("client preferences", () => {
	it("resolves defaults and maps controls onto the synced record", async () => {
		const memory = createMemoryPreferenceBackend();
		const putSettings = vi.spyOn(memory.backend, "putSettings");
		const store = create(memory.backend);
		expect(store.client()).toMatchObject({
			theme: "system",
			warnOnExternalLinks: true,
			blueskyClient: "bluesky",
			voiceView: { showOwnCamera: true },
		});

		await store.setControls({
			swipeLeftAction: "reply",
			confirmVoiceJoin: true,
		});
		await store.setClient({ voiceView: { showOwnCamera: false } });

		expect(memory.state().client).toEqual({
			controls: { swipeLeftAction: "reply" },
			voiceView: { confirmJoin: true, showOwnCamera: false },
		});
		expect(store.controls()).toMatchObject({
			swipeLeftAction: "reply",
			confirmVoiceJoin: true,
		});
		expect(putSettings.mock.lastCall?.[1]).toEqual({
			client: memory.state().client,
		});
	});

	it("falls back for values this client does not know", () => {
		const store = create(createMemoryPreferenceBackend().backend);
		store.adopt(
			prefs({
				client: {
					theme: "sepia",
					blueskyClient: "elsewhere",
					controls: { doubleTapAction: "wave" },
				},
			}),
		);
		expect(store.client().theme).toBe("system");
		expect(store.client().blueskyClient).toBe("bluesky");
		expect(store.controls().doubleTapAction).toBe("react");
	});

	it("opens the inbox as a popover unless the synced record says modal", async () => {
		const memory = createMemoryPreferenceBackend();
		const store = create(memory.backend);
		expect(store.client().inboxPresentation).toBe("popover");

		await store.setClient({ inboxPresentation: "modal" });
		expect(store.client().inboxPresentation).toBe("modal");
		expect(memory.state().client).toEqual({ inboxPresentation: "modal" });

		store.adopt(prefs({ client: { inboxPresentation: "sheet" } }));
		expect(store.client().inboxPresentation).toBe("popover");
	});
});

describe("composer state", () => {
	it("batches quick changes into one write and skips echoes meanwhile", async () => {
		const memory = createMemoryPreferenceBackend();
		const putSettings = vi.spyOn(memory.backend, "putSettings");
		const store = create(memory.backend);

		store.recordEmoji("🦜");
		store.recordEmoji("🦜");
		store.setSkinTone(3);
		store.recordGif(GIF);
		store.adopt(prefs());
		expect(store.composer().skinTone).toBe(3);
		expect(putSettings).not.toHaveBeenCalled();

		await store.settled();
		expect(putSettings).toHaveBeenCalledOnce();
		expect(memory.state().composer).toMatchObject({
			emojiUsage: { "🦜": { count: 2 } },
			skinTone: 3,
			recentGifs: [GIF],
		});
	});

	it("writes after the delay without being asked", async () => {
		const memory = createMemoryPreferenceBackend();
		const putSettings = vi.spyOn(memory.backend, "putSettings");
		const store = create(memory.backend);
		store.recordEmoji("🦜");
		await vi.waitFor(() => expect(putSettings).toHaveBeenCalledOnce());
	});

	it("keeps recent GIFs unique and newest first", () => {
		const store = create(createMemoryPreferenceBackend().backend);
		const other = { ...GIF, id: "gif-2" };
		store.recordGif(GIF);
		store.recordGif(other);
		store.recordGif(GIF);
		expect(store.composer().recentGifs.map((gif) => gif.id)).toEqual([
			"gif-1",
			"gif-2",
		]);
	});
});

describe("Space notification levels", () => {
	it("sets and clears a level for one Space", async () => {
		const memory = createMemoryPreferenceBackend();
		const putSpaceLevel = vi.spyOn(memory.backend, "putSpaceLevel");
		const store = create(memory.backend);

		await store.setSpaceLevel(SPACE, "nothing");
		expect(store.spaceLevel(SPACE)).toBe("nothing");
		expect(memory.state().spaceLevels).toEqual({ [SPACE]: "nothing" });

		await store.setSpaceLevel(SPACE, undefined);
		expect(store.spaceLevel(SPACE)).toBeUndefined();
		expect(putSpaceLevel.mock.calls).toEqual([
			[SPACE, "nothing"],
			[SPACE, undefined],
		]);
	});

	it("reloads after a refused level", async () => {
		const store = create({
			...createMemoryPreferenceBackend().backend,
			putSpaceLevel: async () => {
				throw new ColibriError({ code: "Unexpected" });
			},
		});
		expect(await store.setSpaceLevel(SPACE, "nothing")).toBe(false);
		expect(store.spaceLevel(SPACE)).toBeUndefined();
	});
});

describe("hidden messages", () => {
	it("follows the global setting until a Space overrides it", async () => {
		const memory = createMemoryPreferenceBackend();
		const putSpaceModeration = vi.spyOn(memory.backend, "putSpaceModeration");
		const store = create(memory.backend);

		expect(store.hidesModerated(SPACE)).toBe(false);
		await store.setClient({ hideModeratedMessages: true });
		expect(store.hidesModerated(SPACE)).toBe(true);

		await store.setSpaceModeration(SPACE, false);
		expect(store.hidesModerated(SPACE)).toBe(false);
		expect(store.hidesModerated(OTHER)).toBe(true);
		expect(memory.state().spaceModeration).toEqual({ [SPACE]: false });

		await store.setSpaceModeration(SPACE, undefined);
		expect(store.spaceModeration(SPACE)).toBeUndefined();
		expect(store.hidesModerated(SPACE)).toBe(true);
		expect(putSpaceModeration.mock.calls).toEqual([
			[SPACE, false],
			[SPACE, undefined],
		]);
	});

	it("reads Space overrides and the global flag from the wire", () => {
		const decoded = fromWire({
			clientPreferences: { hideModeratedMessages: true },
			spaceModerations: [
				{ community: SPACE, hideModeratedMessages: false },
				{ community: OTHER, hideModeratedMessages: "yes" as never },
			],
		});
		expect(decoded.client.hideModeratedMessages).toBe(true);
		expect(decoded.spaceModeration).toEqual({ [SPACE]: false });
	});

	it("reloads after a refused Space override", async () => {
		const store = create({
			...createMemoryPreferenceBackend().backend,
			putSpaceModeration: async () => {
				throw new ColibriError({ code: "Unexpected" });
			},
		});
		expect(await store.setSpaceModeration(SPACE, true)).toBe(false);
		expect(store.spaceModeration(SPACE)).toBeUndefined();
	});
});

describe("orderCommunities", () => {
	const did = (name: string) => `did:plc:${name}` as Did;
	const view = (name: string) => ({ did: did(name) }) as CommunityView;

	it("puts ordered communities first and keeps the rest in place", () => {
		const list = [view("a"), view("b"), view("c"), view("d")];
		expect(
			orderCommunities(list, [did("c"), did("zz"), did("a")])?.map(
				(entry) => entry.did,
			),
		).toEqual([did("c"), did("a"), did("b"), did("d")]);
	});

	it("returns the same list without an order", () => {
		const list = [view("a")];
		expect(orderCommunities(list, [])).toBe(list);
	});
});
