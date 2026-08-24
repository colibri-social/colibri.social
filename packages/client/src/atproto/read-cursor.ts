import type { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import {
	createSnapshotScheduler,
	realSnapshotClock,
} from "./cache/snapshot-scheduler";
import { COLLECTIONS, colibri } from "./lexicons";
import { enqueueSpacePut } from "./outbox/outbox";
import { preferencesSpaceRef } from "./preferences-space";
import type { ChannelReadCursor, ChannelReadRecord } from "./views";
import type { ColibriClient } from "./xrpc";

const log = createLogger("read-cursor");

export const MAX_INTERVAL_MS = 5_000;
export const DEBOUNCE_MS = 1_000;

export type ReadCursorIo = {
	agent: Agent;
	xrpc: ColibriClient;
	actorDid: string;
};

type CommunityState = {
	cursors: Map<string, string>;
	hydrated: boolean;
};

type Scheduler = ReturnType<
	typeof createSnapshotScheduler<string, ReturnType<typeof setTimeout>>
>;

let io: ReadCursorIo | undefined;
const state = new Map<string, CommunityState>();
const schedulers = new Map<string, Scheduler>();
const chains = new Map<string, Promise<void>>();

const enqueue = (communityDid: string, work: () => Promise<void>): void => {
	const chain = (chains.get(communityDid) ?? Promise.resolve()).then(work);
	chains.set(communityDid, chain);
	void chain.finally(() => {
		if (chains.get(communityDid) === chain) chains.delete(communityDid);
	});
};

export const configureReadCursorWriter = (next: ReadCursorIo): void => {
	io = next;
	state.clear();
	schedulers.clear();
	chains.clear();
};

export const resetReadCursorWriter = (): void => {
	io = undefined;
	state.clear();
	schedulers.clear();
	chains.clear();
};

const errorNameOf = (err: unknown): string | undefined => {
	if (!err || typeof err !== "object") return undefined;
	const name = (err as { error?: unknown }).error;
	return typeof name === "string" ? name : undefined;
};

const isMissingRecord = (err: unknown): boolean => {
	const name = errorNameOf(err);
	return (
		name === "RecordNotFound" ||
		name === "RepoNotFound" ||
		name === "SpaceNotFound"
	);
};

const readExisting = async (
	active: ReadCursorIo,
	communityDid: string,
): Promise<ChannelReadRecord | undefined> => {
	try {
		const res = await active.agent.com.atproto.space.getRecord({
			space: preferencesSpaceRef(active.actorDid),
			repo: active.actorDid,
			collection: COLLECTIONS.channelRead,
			rkey: communityDid,
		});
		return res.data.value as ChannelReadRecord;
	} catch (err) {
		if (isMissingRecord(err)) return undefined;
		throw err;
	}
};

const ensureHydrated = async (
	active: ReadCursorIo,
	communityDid: string,
): Promise<CommunityState> => {
	let entry = state.get(communityDid);
	if (entry?.hydrated) return entry;
	if (!entry) {
		entry = { cursors: new Map(), hydrated: false };
		state.set(communityDid, entry);
	}

	try {
		const record = await readExisting(active, communityDid);
		if (record) {
			for (const cursor of record.cursors) {
				if (!entry.cursors.has(cursor.channel)) {
					entry.cursors.set(cursor.channel, cursor.cursor);
				}
			}
		}
	} catch (err) {
		log.warn("failed to hydrate read cursors", {
			code: classifyThrown(err, { method: "space.getRecord" }).code,
		});
	}

	entry.hydrated = true;
	return entry;
};

const persistCommunity = (communityDid: string): void => {
	const active = io;
	if (!active) return;

	enqueue(communityDid, async () => {
		const entry = state.get(communityDid);
		if (!entry || entry.cursors.size === 0) return;

		const cursors: Array<ChannelReadCursor> = [...entry.cursors].map(
			([channel, cursor]) => ({ channel, cursor }),
		);

		try {
			await enqueueSpacePut(
				preferencesSpaceRef(active.actorDid),
				active.actorDid,
				COLLECTIONS.channelRead,
				communityDid,
				{ community: communityDid, cursors },
			);
			const result = await active.xrpc.call(
				colibri.channel.putReadCursors.main,
				{ body: { community: communityDid, cursors } },
			);
			if (!result.ok) {
				log.warn("the appview declined the read cursors", {
					code: result.error.code,
				});
			}
		} catch (err) {
			log.warn("failed to sync read cursors", {
				code: classifyThrown(err, { method: "channel.putReadCursors" }).code,
			});
		}
	});
};

const schedulerFor = (communityDid: string): Scheduler => {
	const existing = schedulers.get(communityDid);
	if (existing) return existing;

	const scheduler = createSnapshotScheduler<
		string,
		ReturnType<typeof setTimeout>
	>({
		maxIntervalMs: MAX_INTERVAL_MS,
		debounceMs: DEBOUNCE_MS,
		clock: realSnapshotClock,
		write: persistCommunity,
	});
	schedulers.set(communityDid, scheduler);
	return scheduler;
};

export const adoptRemoteCursors = (
	communityDid: string,
	entries: readonly ChannelReadCursor[],
): void => {
	if (!io || entries.length === 0) return;

	let entry = state.get(communityDid);
	if (!entry) {
		entry = { cursors: new Map(), hydrated: false };
		state.set(communityDid, entry);
	}

	for (const { channel, cursor } of entries) {
		const current = entry.cursors.get(channel);
		if (current !== undefined && current >= cursor) continue;
		entry.cursors.set(channel, cursor);
	}
};

export const recordRead = (
	communityDid: string,
	channelKey: string,
	messageTid: string,
): void => {
	const active = io;
	if (!active) return;

	enqueue(communityDid, async () => {
		const entry = await ensureHydrated(active, communityDid);
		const current = entry.cursors.get(channelKey);
		if (current !== undefined && current >= messageTid) return;
		entry.cursors.set(channelKey, messageTid);
		schedulerFor(communityDid).schedule(communityDid);
	});
};

export const flushReadCursors = (): void => {
	for (const scheduler of schedulers.values()) scheduler.flush();
};

if (typeof window !== "undefined") {
	window.addEventListener("blur", flushReadCursors);
	window.addEventListener("beforeunload", flushReadCursors);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flushReadCursors();
	});
}
