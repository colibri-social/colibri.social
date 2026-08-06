import type { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import type { ColibriError } from "../errors/error";
import { unregisterAllPush } from "../notifications";
import { createLogger } from "../utils/logger";
import { deleteRecords, listCollections, listRecordKeys } from "./pds";
import type { XrpcClient } from "./xrpc";
import type { DeletedCounts } from "./xrpc/social/colibri/actor";

const log = createLogger("delete-account");

const COLIBRI_PREFIX = "social.colibri.";
const SIGNAL_COLLECTION = "social.colibri.actor.data";

export type DeleteProgress =
	| { step: "push" }
	| { step: "collection"; collection: string; index: number; total: number }
	| { step: "appview" };

export type DeleteAccountResult = {
	deleted?: DeletedCounts;
	failedCollections: Array<{ collection: string; error: ColibriError }>;
	error?: ColibriError;
};

export const orderCollections = (collections: Array<string>): Array<string> => {
	const colibri = collections.filter((nsid) => nsid.startsWith(COLIBRI_PREFIX));
	return [
		...colibri.filter((nsid) => nsid !== SIGNAL_COLLECTION).sort(),
		...colibri.filter((nsid) => nsid === SIGNAL_COLLECTION),
	];
};

export const deleteColibriAccount = async (input: {
	agent: Agent;
	did: string;
	xrpc: XrpcClient;
	onProgress?: (progress: DeleteProgress) => void;
}): Promise<DeleteAccountResult> => {
	const { agent, did, xrpc, onProgress } = input;
	const failedCollections: DeleteAccountResult["failedCollections"] = [];

	onProgress?.({ step: "push" });
	await unregisterAllPush((endpoint, provider) =>
		xrpc.social.colibri.notification.unregisterPush(endpoint, provider),
	);

	let collections: Array<string>;
	try {
		collections = orderCollections(await listCollections(agent, did));
	} catch (err) {
		const error = classifyThrown(err, {
			method: "com.atproto.repo.describeRepo",
		});
		log.error("could not enumerate the repo's collections", {
			code: error.code,
		});
		return { failedCollections, error };
	}

	for (const [index, collection] of collections.entries()) {
		onProgress?.({
			step: "collection",
			collection,
			index,
			total: collections.length,
		});
		try {
			const rkeys = await listRecordKeys(agent, did, collection);
			await deleteRecords(agent, did, collection, rkeys);
		} catch (err) {
			const error = classifyThrown(err, {
				method: "com.atproto.repo.applyWrites",
			});
			log.warn("could not clear a collection", {
				collection,
				code: error.code,
			});
			failedCollections.push({ collection, error });
		}
	}

	onProgress?.({ step: "appview" });
	const res = await xrpc.social.colibri.actor.deleteAccount();
	if (!res.ok) return { failedCollections, error: res.error };

	return { deleted: res.data.deleted, failedCollections };
};
