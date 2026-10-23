import {
	asSpaceRef,
	COLLECTIONS,
	preferencesSpace,
	SELF,
	SPACE_TYPES,
} from "@colibri-social/lexicons";
import {
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
} from "@colibri-social/lib";
import type { Records } from "../remote/records";
import type { Transport } from "../remote/transport";
import { type PreferenceBackend, SETTINGS_FIELDS } from "./types";
import {
	decodeMute,
	encodeChange,
	encodeComposer,
	encodeLeftThread,
	encodeMute,
	fromWire,
} from "./wire";

const log = createLogger("preferences");

const MISSING_SPACE = new Set(["SpaceNotFound", "RepoNotFound", "NotFound"]);

export const isMissingSpace = (error: unknown) =>
	error instanceof ColibriError && MISSING_SPACE.has(error.code);

export const createPreferencesSpace = (transport: Transport) => {
	const space = asSpaceRef(preferencesSpace(transport.did));
	let ready: Promise<void> | undefined;
	const ensure = () => {
		ready ??= transport
			.pdsProcedure("com.atproto.simplespace.createSpace", {
				body: {
					spaceType: SPACE_TYPES.actorPreferences,
					skey: SELF,
					readPolicy: {
						$type: "com.atproto.simplespace.defs#memberListPolicy",
					},
					writePolicy: {
						$type: "com.atproto.simplespace.defs#memberListPolicy",
					},
					appAccess: { $type: "com.atproto.simplespace.defs#open" },
				},
			})
			.then(
				() => undefined,
				(error: unknown) => {
					ready = undefined;
					log.warn("could not create the preferences space", {
						code: classifyThrown(error, {
							method: "com.atproto.simplespace.createSpace",
						}).code,
					});
				},
			);
		return ready;
	};
	const write = async <T>(run: () => Promise<T>): Promise<T> => {
		try {
			return await run();
		} catch (error) {
			if (!(error instanceof ColibriError) || error.code !== "SpaceNotFound")
				throw error;
			await ensure();
			return run();
		}
	};
	return { space, ensure, write };
};

export type PreferencesSpace = ReturnType<typeof createPreferencesSpace>;

export const createRemotePreferenceBackend = (input: {
	transport: Transport;
	records: Records;
	space: PreferencesSpace;
}): PreferenceBackend => {
	const { transport, records, space } = input;
	const target = (collection: string, rkey: string) => ({
		space: space.space,
		collection,
		rkey,
	});
	return {
		load: async () =>
			fromWire(
				(await transport.query(colibri.actor.getPreferences.main)).preferences,
			),
		putSettings: async (current, change) => {
			if (SETTINGS_FIELDS.some((field) => field in change)) {
				const settings = Object.fromEntries(
					SETTINGS_FIELDS.map((field) => [field, current[field]]),
				);
				await space.write(() =>
					records.putInSpace(target(COLLECTIONS.settings, SELF), settings),
				);
			}
			if (change.client)
				await space.write(() =>
					records.putInSpace(
						target(COLLECTIONS.clientPreferences, SELF),
						current.client,
					),
				);
			if (change.composer)
				await space.write(() =>
					records.putInSpace(
						target(COLLECTIONS.composerState, SELF),
						encodeComposer(current.composer),
					),
				);
			const result = await transport.procedure(colibri.actor.putSettings.main, {
				body: encodeChange(change),
			});
			return fromWire(result.preferences);
		},
		putSpaceLevel: async (community, level) => {
			const record = target(COLLECTIONS.spaceNotification, community);
			if (level)
				await space.write(() =>
					records.putInSpace(record, {
						level,
						createdAt: new Date().toISOString(),
					}),
				);
			else await records.deleteInSpace(record);
			const result = await transport.procedure(
				colibri.actor.putSpaceNotification.main,
				{
					body: level ? { community, level } : { community, removeLevel: true },
				},
			);
			return fromWire(result.preferences);
		},
		putSpaceModeration: async (community, hideModeratedMessages) => {
			const record = target(COLLECTIONS.spaceModeration, community);
			if (hideModeratedMessages === undefined)
				await records.deleteInSpace(record);
			else
				await space.write(() =>
					records.putInSpace(record, {
						hideModeratedMessages,
						createdAt: new Date().toISOString(),
					}),
				);
			const result = await transport.procedure(
				colibri.actor.putSpaceModeration.main,
				{
					body:
						hideModeratedMessages === undefined
							? { community, remove: true }
							: { community, hideModeratedMessages },
				},
			);
			return fromWire(result.preferences);
		},
		listMutes: async () => {
			try {
				const found = await records.listInSpace({
					space: space.space,
					collection: COLLECTIONS.mute,
				});
				return found.flatMap((record) => {
					const mute = decodeMute(
						(record.value ?? {}) as Parameters<typeof decodeMute>[0],
					);
					return mute ? [{ rkey: record.rkey, mute }] : [];
				});
			} catch (error) {
				if (isMissingSpace(error)) return [];
				throw error;
			}
		},
		createMute: async (rkey, mute) => {
			await space.write(() =>
				records.createInSpace(target(COLLECTIONS.mute, rkey), encodeMute(mute)),
			);
		},
		deleteMute: (rkey) => records.deleteInSpace(target(COLLECTIONS.mute, rkey)),
		putMutes: async (mutes) => {
			const result = await transport.procedure(colibri.actor.putMutes.main, {
				body: { mutes: mutes.map(encodeMute) },
			});
			return fromWire(result.preferences);
		},
		putLeftThreads: async (leftThreads) => {
			const result = await transport.procedure(colibri.actor.putMutes.main, {
				body: { leftThreads: leftThreads.map(encodeLeftThread) },
			});
			return fromWire(result.preferences);
		},
	};
};
