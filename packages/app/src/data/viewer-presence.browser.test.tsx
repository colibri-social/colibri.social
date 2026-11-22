import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import type { SpaceCache, SpaceSnapshot } from "./space-cache";
import { createDataStore } from "./store";
import type { ProfileView, SpaceRef } from "./types";

const LOUNGE =
	"at://did:plc:colibrihqspace2a4b6c8d/space/social.colibri.beta.channel.voice/lounge" as SpaceRef;

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const fakeCache = (snapshot: SpaceSnapshot | undefined) => {
	const offered: ProfileView[] = [];
	const cache = {
		snapshot: () => snapshot,
		load: async () => snapshot,
		offerViewer: (viewer: ProfileView) => offered.push(viewer),
		offerCommunities: () => {},
		offerSpace: () => {},
		offerThreads: () => {},
		offerThreadMembers: () => {},
		offerPresence: () => {},
		offerEmoji: () => {},
	} as unknown as SpaceCache;
	return { cache, offered };
};

const setup = (
	snapshot?: (viewer: string) => SpaceSnapshot,
	presence?: ProfileView["presence"],
) => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const base = source.viewer();
	const viewer = presence ? { ...base, presence } : base;
	source.viewer = () => viewer;
	const { cache, offered } = fakeCache(snapshot?.(viewer.did));
	const store = createRoot(() => createDataStore(source, { spaces: cache }));
	return { source, store, viewer, offered };
};

describe("viewer presence", () => {
	it("keeps a live viewer presence when a profile refresh carries an older one", () => {
		const { source, store, viewer } = setup();
		source.emit({
			$type: "presenceEvent",
			did: viewer.did,
			presence: { onlineState: "online", voice: { channel: LOUNGE } },
		});
		source.emit({
			$type: "viewerEvent",
			profile: { ...viewer, presence: { onlineState: "online" } },
		});
		expect(store.presenceOf(viewer.did)?.voice?.channel).toBe(LOUNGE);
	});

	it("replaces a cached viewer presence with the refreshed profile", () => {
		const { source, store, viewer } = setup((did) => ({
			spaces: {},
			ts: Date.now(),
			presence: {
				[did]: { onlineState: "online", voice: { channel: LOUNGE } },
			},
		}));
		expect(store.presenceOf(viewer.did)?.voice?.channel).toBe(LOUNGE);
		source.emit({
			$type: "viewerEvent",
			profile: { ...viewer, presence: { onlineState: "online" } },
		});
		expect(store.presenceOf(viewer.did)?.voice).toBeUndefined();
	});

	it("caches the viewer without a presence", async () => {
		const { offered } = setup(() => ({ spaces: {}, ts: Date.now() }), {
			onlineState: "online",
			voice: { channel: LOUNGE },
		});
		await until(() => offered.length > 0);
		expect(offered.at(-1)).not.toHaveProperty("presence");
	});
});
