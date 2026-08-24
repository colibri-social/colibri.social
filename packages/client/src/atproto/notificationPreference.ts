import type { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { COLLECTIONS, colibri, SELF } from "./lexicons";
import { enqueueSpacePut, queuedRecords } from "./outbox/outbox";
import { preferencesSpaceRef } from "./preferences-space";
import type { ActorSettingsRecord, Preferences } from "./views";
import type { ColibriClient } from "./xrpc";
import type { XrpcResult } from "./xrpc/result";

export type NotificationLevel = ActorSettingsRecord["notificationLevel"];

export type PreferencesOutput = { preferences: Preferences };

export const getPreferences = (
	xrpc: ColibriClient,
): Promise<XrpcResult<PreferencesOutput>> =>
	xrpc.call(colibri.actor.getPreferences.main, {});

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

const readSettingsRecord = async (
	agent: Agent,
	actorDid: string,
): Promise<ActorSettingsRecord | undefined> => {
	try {
		const res = await agent.com.atproto.space.getRecord({
			space: preferencesSpaceRef(actorDid),
			repo: actorDid,
			collection: COLLECTIONS.settings,
			rkey: SELF,
		});
		return res.data.value as ActorSettingsRecord;
	} catch (err) {
		if (isMissingRecord(err)) return undefined;
		throw classifyThrown(err, { method: "space.getRecord" });
	}
};

export type ActorSettingsPatch = Partial<
	Pick<
		ActorSettingsRecord,
		"notificationLevel" | "communityOrder" | "gifFavorites"
	>
>;

const queuedSettingsRecord = (
	actorDid: string,
): ActorSettingsRecord | undefined => {
	const space = preferencesSpaceRef(actorDid);
	const entry = queuedRecords(COLLECTIONS.settings).find(
		(queued) => queued.space === space && queued.rkey === SELF,
	);
	return entry?.record as ActorSettingsRecord | undefined;
};

export const writeActorSettings = async (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	patch: ActorSettingsPatch,
): Promise<XrpcResult<PreferencesOutput>> => {
	const stored = queuedSettingsRecord(actorDid)
		? undefined
		: await readSettingsRecord(agent, actorDid);
	const base = queuedSettingsRecord(actorDid) ?? stored;
	const merged: ActorSettingsPatch = { ...(base ?? {}), ...patch };

	await enqueueSpacePut(
		preferencesSpaceRef(actorDid),
		actorDid,
		COLLECTIONS.settings,
		SELF,
		merged,
	);

	return xrpc.call(colibri.actor.putSettings.main, { body: patch });
};

export const writeNotificationLevel = (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	notificationLevel: NotificationLevel,
): Promise<XrpcResult<PreferencesOutput>> =>
	writeActorSettings(agent, xrpc, actorDid, { notificationLevel });

export const writeCommunityOrder = (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	communityOrder: ActorSettingsRecord["communityOrder"],
): Promise<XrpcResult<PreferencesOutput>> =>
	writeActorSettings(agent, xrpc, actorDid, { communityOrder });
