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

export const getRecord = async (
	agent: Agent,
	repo: string,
	collection: string,
	rkey: string,
): Promise<Record<string, unknown>> => {
	const res = await agent.com.atproto.repo.getRecord({
		repo,
		collection,
		rkey,
	});
	return res.data.value as Record<string, unknown>;
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

export const listCollections = async (
	agent: Agent,
	repo: string,
): Promise<Array<string>> => {
	const res = await agent.com.atproto.repo.describeRepo({ repo });
	return res.data.collections;
};

export const listRecordKeys = async (
	agent: Agent,
	repo: string,
	collection: string,
): Promise<Array<string>> => {
	const rkeys: Array<string> = [];
	let cursor: string | undefined;

	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo,
			collection,
			limit: 100,
			cursor,
		});
		for (const record of res.data.records)
			rkeys.push(AtURI.parseAtURI(record.uri).identifier);
		cursor = res.data.cursor;
	} while (cursor);

	return rkeys;
};

const APPLY_WRITES_CHUNK = 200;

export const deleteRecords = async (
	agent: Agent,
	repo: string,
	collection: string,
	rkeys: Array<string>,
): Promise<void> => {
	for (let index = 0; index < rkeys.length; index += APPLY_WRITES_CHUNK) {
		const chunk = rkeys.slice(index, index + APPLY_WRITES_CHUNK);
		await agent.com.atproto.repo.applyWrites({
			repo,
			writes: chunk.map((rkey) => ({
				$type: "com.atproto.repo.applyWrites#delete",
				collection,
				rkey,
			})),
		});
	}
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
			(r.value as Record<string, unknown>).parent === messageUri &&
			(r.value as Record<string, unknown>).emoji === emoji,
	);
	return match ? AtURI.parseAtURI(match.uri).identifier : undefined;
};
