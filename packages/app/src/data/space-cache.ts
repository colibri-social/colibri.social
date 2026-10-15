import {
	capList,
	createSnapshotScheduler,
	isSnapshotUsable,
	type KvStore,
	pruneSnapshotEntries,
	realSnapshotClock,
	type SnapshotScheduler,
	SPACE_MEMBER_LIMIT,
	SPACE_SNAPSHOT_LIMIT,
	SPACE_THREAD_CHANNEL_LIMIT,
	WINDOW_WRITE_DEBOUNCE_MS,
	WINDOW_WRITE_MAX_INTERVAL_MS,
} from "@colibri-social/lib";
import { prepareNamespace, SPACES_STORE, sharedStore } from "./message-cache";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	MemberView,
	ProfileView,
	RoleView,
	ThreadView,
} from "./types";

export type CachedUnread = { hasUnread: boolean; mentions: number };

export type SpaceEntry = {
	categories?: CategoryView[];
	channels?: ChannelView[];
	roles?: RoleView[];
	members?: MemberView[];
	unread?: Record<string, CachedUnread>;
	threads?: Record<string, ThreadView[]>;
	ts: number;
};

export type SpaceSnapshot = {
	viewer?: ProfileView;
	communities?: CommunityView[];
	spaces: Record<string, SpaceEntry>;
	ts: number;
};

export type SpacePatch = Partial<Omit<SpaceEntry, "ts" | "threads">>;

export type SpaceCache = {
	snapshot: () => SpaceSnapshot | undefined;
	load: () => Promise<SpaceSnapshot | undefined>;
	offerViewer: (viewer: ProfileView) => void;
	offerCommunities: (communities: readonly CommunityView[]) => void;
	offerSpace: (community: string, patch: SpacePatch) => void;
	offerThreads: (
		community: string,
		channel: string,
		threads: readonly ThreadView[],
	) => void;
	forgetCommunity: (community: string) => void;
	isGone: (community: string) => boolean;
	flush: () => Promise<void>;
	clear: () => Promise<void>;
};

const emptySnapshot = (now: number): SpaceSnapshot => ({ spaces: {}, ts: now });

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createSpaceCache = (options: {
	namespace: string;
	kv?: KvStore | null;
	now?: () => number;
}): SpaceCache => {
	const kv = options.kv === undefined ? sharedStore() : options.kv;
	const now = options.now ?? Date.now;
	const gone = new Set<string>();
	const writes = new Set<Promise<void>>();
	let loaded: SpaceSnapshot | undefined;
	let current: SpaceSnapshot = emptySnapshot(now());
	let loading: Promise<SpaceSnapshot | undefined> | undefined;

	const track = (work: Promise<void>) => {
		writes.add(work);
		void work.finally(() => writes.delete(work));
	};

	const persist = (snapshot: SpaceSnapshot) => {
		if (!kv) return;
		track(
			prepareNamespace(kv, options.namespace).then(() =>
				kv.put(SPACES_STORE, options.namespace, snapshot),
			),
		);
	};

	const scheduler: SnapshotScheduler<SpaceSnapshot> = createSnapshotScheduler<
		SpaceSnapshot,
		ReturnType<typeof setTimeout>
	>({
		debounceMs: WINDOW_WRITE_DEBOUNCE_MS,
		maxIntervalMs: WINDOW_WRITE_MAX_INTERVAL_MS,
		clock: realSnapshotClock,
		write: persist,
	});

	const keepIds = () =>
		current.communities
			? new Set(current.communities.map((community) => community.did))
			: undefined;

	const commit = () => {
		current = {
			...current,
			spaces: pruneSnapshotEntries(
				current.spaces,
				keepIds(),
				SPACE_SNAPSHOT_LIMIT,
			),
			ts: now(),
		};
		scheduler.schedule(current);
	};

	if (typeof window !== "undefined") {
		window.addEventListener("pagehide", () => scheduler.flush());
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") scheduler.flush();
		});
	}

	const usable = (snapshot: SpaceSnapshot | undefined) => {
		if (!snapshot || !isSnapshotUsable(snapshot.ts, now())) return undefined;
		if (!snapshot.communities || !snapshot.viewer) return undefined;
		return snapshot;
	};

	const entryFor = (community: string): SpaceEntry =>
		current.spaces[community] ?? { ts: now() };

	return {
		snapshot: () => loaded,
		load: () => {
			loading ??= (async () => {
				if (!kv) return undefined;
				await prepareNamespace(kv, options.namespace);
				const stored = usable(
					await kv.get<SpaceSnapshot>(SPACES_STORE, options.namespace),
				);
				if (stored) {
					loaded = stored;
					current = { ...stored, spaces: { ...stored.spaces } };
				}
				return stored;
			})();
			return loading;
		},
		offerViewer: (viewer) => {
			current = { ...current, viewer: plain(viewer) };
			commit();
		},
		offerCommunities: (communities) => {
			current = {
				...current,
				communities: plain(
					communities.filter((community) => !gone.has(community.did)),
				),
			};
			commit();
		},
		offerSpace: (community, patch) => {
			if (gone.has(community)) return;
			const next: SpaceEntry = { ...entryFor(community), ts: now() };
			if (patch.categories) next.categories = plain(patch.categories);
			if (patch.channels) next.channels = plain(patch.channels);
			if (patch.roles) next.roles = plain(patch.roles);
			if (patch.members)
				next.members = plain(capList(patch.members, SPACE_MEMBER_LIMIT));
			if (patch.unread) next.unread = plain(patch.unread);
			current = {
				...current,
				spaces: { ...current.spaces, [community]: next },
			};
			commit();
		},
		offerThreads: (community, channel, threads) => {
			if (gone.has(community)) return;
			const entry = entryFor(community);
			const lists = Object.entries({
				...entry.threads,
				[channel]: plain([...threads]),
			}).slice(-SPACE_THREAD_CHANNEL_LIMIT);
			current = {
				...current,
				spaces: {
					...current.spaces,
					[community]: {
						...entry,
						threads: Object.fromEntries(lists),
						ts: now(),
					},
				},
			};
			commit();
		},
		forgetCommunity: (community) => {
			gone.add(community);
			const { [community]: _removed, ...rest } = current.spaces;
			current = {
				...current,
				spaces: rest,
				communities: current.communities?.filter(
					(entry) => entry.did !== community,
				),
			};
			commit();
			scheduler.flush();
		},
		isGone: (community) => gone.has(community),
		flush: async () => {
			scheduler.flush();
			await Promise.all([...writes]);
		},
		clear: async () => {
			loaded = undefined;
			current = emptySnapshot(now());
			await Promise.all([...writes]);
			if (kv) await kv.remove(SPACES_STORE, options.namespace);
		},
	};
};
