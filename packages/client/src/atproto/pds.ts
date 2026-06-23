/**
 * Thin wrappers over `com.atproto.repo.*` agent methods for direct PDS
 * record operations. All callers should import from here rather than
 * calling the agent directly — this centralises $type injection and
 * keeps call sites clean.
 */
import type { Agent } from "@atproto/api";
import type { BlobRef } from "@atproto/lexicon";
import { AtURI } from "../utils/at-uri";

export const createRecord = async (
	agent: Agent,
	repo: string,
	collection: string,
	record: Record<string, unknown>,
): Promise<{ uri: string; cid: string }> => {
	const res = await agent.com.atproto.repo.createRecord({
		repo,
		collection,
		record: { $type: collection, ...record },
	});
	return res.data;
};

export const putRecord = async (
	agent: Agent,
	repo: string,
	collection: string,
	rkey: string,
	record: Record<string, unknown>,
): Promise<void> => {
	await agent.com.atproto.repo.putRecord({
		repo,
		collection,
		rkey,
		record: { $type: collection, ...record },
	});
};

/**
 * Uploads a file to the user's PDS and returns the resulting blob reference,
 * ready to be embedded in a record (e.g. an avatar or banner on a profile).
 */
export const uploadBlob = async (
	agent: Agent,
	file: Blob,
): Promise<BlobRef> => {
	const res = await agent.com.atproto.repo.uploadBlob(file, {
		encoding: file.type,
	});
	return res.data.blob;
};

export const deleteRecord = async (
	agent: Agent,
	repo: string,
	collection: string,
	rkey: string,
): Promise<void> => {
	await agent.com.atproto.repo.deleteRecord({ repo, collection, rkey });
};

/**
 * Fallback for when the reaction rkey isn't in the in-memory cache (e.g.
 * after a page reload). Lists the user's reaction records and returns the
 * rkey of the one matching `messageUri` + `emoji`, or `undefined` if none.
 */
export const findReactionRkey = async (
	agent: Agent,
	userDid: string,
	messageUri: string,
	emoji: string,
): Promise<string | undefined> => {
	const res = await agent.com.atproto.repo.listRecords({
		repo: userDid,
		collection: "social.colibri.reaction",
		limit: 100,
	});
	const match = res.data.records.find(
		(r) =>
			(r.value as Record<string, unknown>).targetMessage === messageUri &&
			(r.value as Record<string, unknown>).emoji === emoji,
	);
	return match ? AtURI.parseAtURI(match.uri).identifier : undefined;
};
