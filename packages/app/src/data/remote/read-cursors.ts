import {
	classifyThrown,
	createLogger,
	createSnapshotScheduler,
	realSnapshotClock,
	type SnapshotClock,
	type SnapshotScheduler,
} from "@colibri-social/lib";

const log = createLogger("remote/read-cursors");

export const READ_CURSOR_DEBOUNCE_MS = 1_000;
export const READ_CURSOR_MAX_INTERVAL_MS = 5_000;

export type ChannelCursor = { channel: string; cursor: string };

export type ReadCursorIo = {
	hydrate: (community: string) => Promise<readonly ChannelCursor[]>;
	persist: (community: string, cursors: ChannelCursor[]) => Promise<void>;
	push: (community: string, cursors: ChannelCursor[]) => Promise<void>;
};

type CommunityState = {
	cursors: Map<string, string>;
	hydrated?: Promise<void>;
};

export const createReadCursorWriter = <H = ReturnType<typeof setTimeout>>(
	io: ReadCursorIo,
	options: {
		clock?: SnapshotClock<H>;
		debounceMs?: number;
		maxIntervalMs?: number;
	} = {},
) => {
	const clock = (options.clock ??
		realSnapshotClock) as unknown as SnapshotClock<H>;
	const state = new Map<string, CommunityState>();
	const schedulers = new Map<string, SnapshotScheduler<string>>();
	const chains = new Map<string, Promise<void>>();

	const entryFor = (community: string) => {
		let entry = state.get(community);
		if (!entry) {
			entry = { cursors: new Map() };
			state.set(community, entry);
		}
		return entry;
	};

	const bump = (community: string, channel: string, cursor: string) => {
		const entry = entryFor(community);
		const current = entry.cursors.get(channel);
		if (current !== undefined && current >= cursor) return false;
		entry.cursors.set(channel, cursor);
		return true;
	};

	const hydrate = (community: string) => {
		const entry = entryFor(community);
		entry.hydrated ??= io.hydrate(community).then(
			(cursors) => {
				for (const { channel, cursor } of cursors)
					bump(community, channel, cursor);
			},
			(error: unknown) => {
				entry.hydrated = undefined;
				throw error;
			},
		);
		return entry.hydrated;
	};

	const enqueue = (community: string, work: () => Promise<void>) => {
		const chain = (chains.get(community) ?? Promise.resolve())
			.then(work)
			.catch((error: unknown) => {
				log.warn("could not save read positions", {
					code: classifyThrown(error, { method: "channel.putReadCursors" })
						.code,
				});
			});
		chains.set(community, chain);
		void chain.finally(() => {
			if (chains.get(community) === chain) chains.delete(community);
		});
		return chain;
	};

	const write = (community: string) =>
		enqueue(community, async () => {
			await hydrate(community);
			const cursors = [...entryFor(community).cursors].map(
				([channel, cursor]) => ({ channel, cursor }),
			);
			if (cursors.length === 0) return;
			try {
				await io.persist(community, cursors);
			} catch (error) {
				log.warn("could not store read positions on the account", {
					code: classifyThrown(error, { method: "space.putRecord" }).code,
				});
			}
			await io.push(community, cursors);
		});

	const schedulerFor = (community: string) => {
		let scheduler = schedulers.get(community);
		if (!scheduler) {
			scheduler = createSnapshotScheduler<string, H>({
				maxIntervalMs: options.maxIntervalMs ?? READ_CURSOR_MAX_INTERVAL_MS,
				debounceMs: options.debounceMs ?? READ_CURSOR_DEBOUNCE_MS,
				clock,
				write: (target) => void write(target),
			});
			schedulers.set(community, scheduler);
		}
		return scheduler;
	};

	return {
		record: (community: string, channel: string, cursor: string) => {
			if (!bump(community, channel, cursor)) return false;
			schedulerFor(community).schedule(community);
			return true;
		},
		adopt: (community: string, cursors: readonly ChannelCursor[]) => {
			for (const { channel, cursor } of cursors)
				bump(community, channel, cursor);
		},
		recall: (community: string, channel: string) =>
			state.get(community)?.cursors.get(channel),
		flush: async () => {
			for (const scheduler of schedulers.values()) scheduler.flush();
			await Promise.all([...chains.values()]);
		},
	};
};

export type ReadCursorWriter = ReturnType<typeof createReadCursorWriter>;
