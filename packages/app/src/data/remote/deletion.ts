import { COLLECTIONS, SELF } from "@colibri-social/lexicons";
import {
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
} from "@colibri-social/lib";
import type { PreferencesSpace } from "../preferences/remote";
import type {
	DeletionHost,
	DeletionProgress,
	DeletionResult,
	DeletionStatus,
} from "../source";
import type { CommunityView } from "../types";
import type { Records } from "./records";
import type { Transport } from "./transport";

const log = createLogger("deletion");

export const PERSONAL_COLLECTIONS = [
	COLLECTIONS.settings,
	COLLECTIONS.clientPreferences,
	COLLECTIONS.composerState,
	COLLECTIONS.mute,
	COLLECTIONS.spaceNotification,
	COLLECTIONS.channelRead,
	COLLECTIONS.threadFollow,
] as const;

const PROFILE_COLLECTION = COLLECTIONS.profile;

const MISSING = new Set(["SpaceNotFound", "RepoNotFound", "NotFound"]);

type ServerDescription = {
	did?: string;
	contact?: { email?: string };
};

const hostOf = (description: ServerDescription): DeletionHost => ({
	name: description.did?.startsWith("did:web:")
		? description.did.slice("did:web:".length)
		: undefined,
	contactEmail: description.contact?.email || undefined,
});

const rkeyOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

export const createDeletion = (input: {
	transport: Transport;
	records: Records;
	space: PreferencesSpace;
}) => {
	const { transport, records, space } = input;

	const describeHost = async (): Promise<DeletionHost> => {
		try {
			return hostOf(
				await transport.pdsQuery<ServerDescription>(
					"com.atproto.server.describeServer",
				),
			);
		} catch (error) {
			log.warn("could not describe the account host", {
				code: classifyThrown(error).code,
			});
			return {};
		}
	};

	const getDeletionStatus = async (): Promise<DeletionStatus> => {
		const [status, host] = await Promise.all([
			transport.query(colibri.actor.getDeletionStatus.main),
			describeHost(),
		]);
		return {
			soleOwned: status.soleOwnedCommunities as CommunityView[],
			host,
		};
	};

	const listPersonal = async () => {
		const found: { collection: string; rkey: string }[] = [];
		for (const collection of PERSONAL_COLLECTIONS) {
			try {
				const listed = await records.listInSpace({
					space: space.space,
					collection,
				});
				for (const record of listed)
					found.push({ collection, rkey: rkeyOf(record.uri) });
			} catch (error) {
				if (error instanceof ColibriError && MISSING.has(error.code)) continue;
				throw error;
			}
		}
		return found;
	};

	const deleteColibriData = async (
		onProgress?: (progress: DeletionProgress) => void,
	): Promise<DeletionResult> => {
		let incomplete = false;
		const personal = await listPersonal().catch((error: unknown) => {
			incomplete = true;
			log.warn("could not list personal records", {
				code: classifyThrown(error).code,
			});
			return [];
		});
		const total = personal.length + 1;
		let done = 0;
		onProgress?.({ step: "records", done, total });
		for (const entry of personal) {
			try {
				await records.deleteInSpace({ space: space.space, ...entry });
			} catch (error) {
				incomplete = true;
				log.warn("could not delete a personal record", {
					collection: entry.collection,
					code: classifyThrown(error).code,
				});
			}
			done += 1;
			onProgress?.({ step: "records", done, total });
		}
		try {
			await transport.pdsProcedure("com.atproto.repo.deleteRecord", {
				body: {
					repo: transport.did,
					collection: PROFILE_COLLECTION,
					rkey: SELF,
				},
			});
		} catch (error) {
			const { code } = classifyThrown(error);
			if (!MISSING.has(code)) {
				incomplete = true;
				log.warn("could not delete the profile record", { code });
			}
		}
		onProgress?.({ step: "records", done: total, total });
		onProgress?.({ step: "server" });
		await transport.procedure(colibri.actor.deleteAccount.main, { body: {} });
		return { incomplete };
	};

	return { getDeletionStatus, deleteColibriData };
};
