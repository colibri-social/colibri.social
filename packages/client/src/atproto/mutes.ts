import type { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { asDid, asSpaceRef, COLLECTIONS, colibri } from "./lexicons";
import type { PreferencesOutput } from "./notificationPreference";
import { enqueueSpaceCreate, enqueueSpaceDelete } from "./outbox/outbox";
import { preferencesSpaceRef } from "./preferences-space";
import type { ActorMuteRecord, Mute } from "./views";
import type { ColibriClient } from "./xrpc";
import type { XrpcResult } from "./xrpc/result";

const log = createLogger("mutes");

const MUTED_ACTOR_TYPE = "social.colibri.beta.actor.defs#mutedActor";
const MUTED_CHANNEL_TYPE = "social.colibri.beta.actor.defs#mutedChannel";

type WireMuteSubject = ActorMuteRecord["subject"];

export type MuteSubject =
	| { kind: "actor"; did: string }
	| { kind: "channel"; channel: string };

export const encodeMuteSubject = (subject: MuteSubject): WireMuteSubject =>
	subject.kind === "actor"
		? { $type: MUTED_ACTOR_TYPE, did: asDid(subject.did) }
		: { $type: MUTED_CHANNEL_TYPE, channel: asSpaceRef(subject.channel) };

export const decodeMuteSubject = (
	subject: WireMuteSubject,
): MuteSubject | undefined => {
	if (subject.$type === MUTED_ACTOR_TYPE) {
		return { kind: "actor", did: subject.did };
	}
	if (subject.$type === MUTED_CHANNEL_TYPE) {
		return { kind: "channel", channel: subject.channel };
	}
	return undefined;
};

export const muteSubjectKey = (subject: MuteSubject): string =>
	subject.kind === "actor" ? subject.did : subject.channel;

type MuteRecordState = {
	rkey: string;
	createdAt: string;
	subject: MuteSubject;
};
type MuteState = { bySubject: Map<string, MuteRecordState> };

let muteState: MuteState | undefined;
let hydrating: Promise<MuteState> | undefined;

const errorNameOf = (err: unknown): string | undefined => {
	if (!err || typeof err !== "object") return undefined;
	const name = (err as { error?: unknown }).error;
	return typeof name === "string" ? name : undefined;
};

const isMissingRepo = (err: unknown): boolean => {
	const name = errorNameOf(err);
	return name === "RepoNotFound" || name === "SpaceNotFound";
};

const announceMutes = async (
	xrpc: ColibriClient,
	state: MuteState,
): Promise<XrpcResult<PreferencesOutput>> =>
	xrpc.call(colibri.actor.putMutes.main, {
		body: { mutes: toMuteList(state) },
	});

const listMuteRecords = async (
	agent: Agent,
	actorDid: string,
	space: string,
): Promise<Map<string, MuteRecordState>> => {
	const bySubject = new Map<string, MuteRecordState>();
	let cursor: string | undefined;

	do {
		try {
			const res = await agent.com.atproto.space.listRecords({
				space,
				repo: actorDid,
				collection: COLLECTIONS.mute,
				cursor,
			});
			for (const record of res.data.records) {
				const value = record.value as ActorMuteRecord;
				const subject = decodeMuteSubject(value.subject);
				if (!subject) continue;
				bySubject.set(muteSubjectKey(subject), {
					rkey: record.rkey,
					createdAt: value.createdAt,
					subject,
				});
			}
			cursor = res.data.cursor;
		} catch (err) {
			if (isMissingRepo(err)) return bySubject;
			throw err;
		}
	} while (cursor);

	return bySubject;
};

const toMuteList = (state: MuteState): Array<Mute> =>
	[...state.bySubject.values()].map(
		({ subject, createdAt }) =>
			({ subject: encodeMuteSubject(subject), createdAt }) as Mute,
	);

const ensureHydrated = (
	agent: Agent,
	actorDid: string,
	space: string,
): Promise<MuteState> => {
	if (muteState) return Promise.resolve(muteState);
	if (!hydrating) {
		hydrating = listMuteRecords(agent, actorDid, space)
			.then((bySubject) => {
				muteState = { bySubject };
				return muteState;
			})
			.finally(() => {
				hydrating = undefined;
			});
	}
	return hydrating;
};

export const hydrateMutes = async (
	agent: Agent,
	actorDid: string,
): Promise<Array<MuteSubject>> => {
	const space = preferencesSpaceRef(actorDid);
	try {
		const bySubject = await listMuteRecords(agent, actorDid, space);
		muteState = { bySubject };
	} catch (err) {
		log.warn("failed to hydrate mutes", {
			code: classifyThrown(err, { method: "space.listRecords" }).code,
		});
		muteState = muteState ?? { bySubject: new Map() };
	}
	return [...muteState.bySubject.values()].map((record) => record.subject);
};

export const muteSubject = async (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	subject: MuteSubject,
): Promise<XrpcResult<PreferencesOutput>> => {
	const space = preferencesSpaceRef(actorDid);
	const state = await ensureHydrated(agent, actorDid, space);
	const key = muteSubjectKey(subject);

	if (!state.bySubject.has(key)) {
		const createdAt = new Date().toISOString();
		try {
			const { rkey } = await enqueueSpaceCreate(
				space,
				actorDid,
				COLLECTIONS.mute,
				{ subject: encodeMuteSubject(subject), createdAt },
			);
			state.bySubject.set(key, { rkey, createdAt, subject });
		} catch (err) {
			const classified = classifyThrown(err, {
				method: "space.createRecord",
			});
			log.error("failed to queue a mute", { code: classified.code });
			throw classified;
		}
	}

	return announceMutes(xrpc, state);
};

export const unmuteSubject = async (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	subject: MuteSubject,
): Promise<XrpcResult<PreferencesOutput>> => {
	const space = preferencesSpaceRef(actorDid);
	const state = await ensureHydrated(agent, actorDid, space);
	const key = muteSubjectKey(subject);
	const existing = state.bySubject.get(key);

	if (existing) {
		try {
			await enqueueSpaceDelete(
				space,
				actorDid,
				COLLECTIONS.mute,
				existing.rkey,
			);
			state.bySubject.delete(key);
		} catch (err) {
			const classified = classifyThrown(err, {
				method: "space.deleteRecord",
			});
			log.error("failed to queue an unmute", { code: classified.code });
			throw classified;
		}
	}

	return announceMutes(xrpc, state);
};

export const resetMutes = (): void => {
	muteState = undefined;
	hydrating = undefined;
};
