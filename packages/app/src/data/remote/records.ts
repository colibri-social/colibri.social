import { ColibriError } from "@colibri-social/lib";
import type { Transport } from "./transport";

export type BlobRef = {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
};

export type StoredRecord = { uri: string; cid?: string; value: unknown };

type SpaceTarget = {
	space: string;
	collection: string;
	rkey: string;
	repo?: string;
};

const RECORD_PAGE = 100;
const RECORD_SCAN_LIMIT = 10;

export const createRecords = (transport: Transport) => {
	const repoOf = (target: { repo?: string }) => target.repo ?? transport.did;

	const write = (
		nsid: "com.atproto.space.createRecord" | "com.atproto.space.putRecord",
		target: SpaceTarget,
		record: Record<string, unknown>,
	) =>
		transport.pdsProcedure<{ uri: string; cid: string }>(nsid, {
			body: {
				space: target.space,
				repo: repoOf(target),
				collection: target.collection,
				rkey: target.rkey,
				record: { $type: target.collection, ...record },
			},
		});

	return {
		createInSpace: (target: SpaceTarget, record: Record<string, unknown>) =>
			write("com.atproto.space.createRecord", target, record),
		putInSpace: (target: SpaceTarget, record: Record<string, unknown>) =>
			write("com.atproto.space.putRecord", target, record),
		deleteInSpace: async (target: SpaceTarget) => {
			try {
				await transport.pdsProcedure("com.atproto.space.deleteRecord", {
					body: {
						space: target.space,
						repo: repoOf(target),
						collection: target.collection,
						rkey: target.rkey,
					},
				});
			} catch (error) {
				if (error instanceof ColibriError && error.code === "NotFound") return;
				throw error;
			}
		},
		getInSpace: (target: SpaceTarget) =>
			transport.pdsQuery<StoredRecord>("com.atproto.space.getRecord", {
				params: {
					space: target.space,
					repo: repoOf(target),
					collection: target.collection,
					rkey: target.rkey,
				},
			}),
		findInSpace: async (
			target: { space: string; collection: string; repo?: string },
			match: (value: Record<string, unknown>) => boolean,
		): Promise<StoredRecord | undefined> => {
			let cursor: string | undefined;
			for (let page = 0; page < RECORD_SCAN_LIMIT; page++) {
				const result = await transport.pdsQuery<{
					cursor?: string;
					records: StoredRecord[];
				}>("com.atproto.space.listRecords", {
					params: {
						space: target.space,
						repo: repoOf(target),
						collection: target.collection,
						limit: RECORD_PAGE,
						cursor,
					},
				});
				const hit = result.records.find((record) =>
					match((record.value ?? {}) as Record<string, unknown>),
				);
				if (hit) return hit;
				if (!result.cursor || result.records.length === 0) return undefined;
				cursor = result.cursor;
			}
			return undefined;
		},
		listInSpace: async (target: {
			space: string;
			collection: string;
			repo?: string;
		}): Promise<StoredRecord[]> => {
			const found: StoredRecord[] = [];
			let cursor: string | undefined;
			for (let page = 0; page < RECORD_SCAN_LIMIT; page++) {
				const result = await transport.pdsQuery<{
					cursor?: string;
					records: StoredRecord[];
				}>("com.atproto.space.listRecords", {
					params: {
						space: target.space,
						repo: repoOf(target),
						collection: target.collection,
						limit: RECORD_PAGE,
						cursor,
					},
				});
				found.push(...result.records);
				if (!result.cursor || result.records.length === 0) break;
				cursor = result.cursor;
			}
			return found;
		},
		getInRepo: async (collection: string, rkey: string) => {
			try {
				return await transport.pdsQuery<StoredRecord>(
					"com.atproto.repo.getRecord",
					{ params: { repo: transport.did, collection, rkey } },
				);
			} catch (error) {
				if (error instanceof ColibriError && error.status === 400)
					return undefined;
				throw error;
			}
		},
		putInRepo: (
			collection: string,
			rkey: string,
			record: Record<string, unknown>,
		) =>
			transport.pdsProcedure<{ uri: string; cid: string }>(
				"com.atproto.repo.putRecord",
				{
					body: {
						repo: transport.did,
						collection,
						rkey,
						record: { $type: collection, ...record },
					},
				},
			),
		uploadBlob: async (file: Blob, signal?: AbortSignal) => {
			const result = await transport.pdsProcedure<{ blob: BlobRef }>(
				"com.atproto.repo.uploadBlob",
				{
					raw: {
						data: file,
						encoding: file.type || "application/octet-stream",
					},
					signal,
				},
			);
			return result.blob;
		},
	};
};

export type Records = ReturnType<typeof createRecords>;
