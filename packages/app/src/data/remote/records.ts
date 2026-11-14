import type { social } from "@colibri-social/lexicons";
import { ColibriError, colibri } from "@colibri-social/lib";
import {
	type HostModeSignal,
	isHostMismatch,
	isRecordMissing,
	isRepoNotHosted,
} from "../polyfill/host-mode";

type ApplyWritesInput = social.colibri.beta.polyfill.applyWrites.$InputBody;

type PolyfillWrite = ApplyWritesInput["writes"][number];

type RecordView = social.colibri.beta.polyfill.defs.RecordView;

import type { Transport } from "./transport";

export type BlobRef = {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
};

export type StoredRecord = { uri: string; cid?: string; value: unknown };

export type SpaceListedRecord = {
	collection: string;
	rkey: string;
	cid?: string;
	value?: unknown;
};

type SpaceTarget = {
	space: string;
	collection: string;
	rkey: string;
	repo?: string;
};

type CollectionTarget = { space: string; collection: string; repo?: string };

type ListedPage = { cursor?: string; records: SpaceListedRecord[] };

const RECORD_PAGE = 100;
const HOSTED_RECORD_PAGE = 100;
const RECORD_SCAN_LIMIT = 10;

const TOO_LARGE_ENVELOPE_CODES = new Set(["PayloadTooLarge", "BlobTooLarge"]);

const isBlobRejectedAsTooLarge = (error: unknown): error is ColibriError => {
	if (!(error instanceof ColibriError)) return false;
	if (error.status === 413) return true;

	const unknownCode = error.context.unknownCode;

	return (
		typeof unknownCode === "string" && TOO_LARGE_ENVELOPE_CODES.has(unknownCode)
	);
};

const rawOf = (file: Blob) => {
	return { data: file, encoding: file.type || "application/octet-stream" };
};

const rkeyOf = (uri: string) => {
	return uri.slice(uri.lastIndexOf("/") + 1);
};

const listedOf = (collection: string, view: RecordView): SpaceListedRecord => {
	return {
		collection,
		rkey: rkeyOf(view.uri),
		cid: view.cid,
		value: view.value,
	};
};

const tooLargeOf = (error: unknown, method: string, size: number) => {
	if (!isBlobRejectedAsTooLarge(error)) return error;

	return new ColibriError({
		code: "ServerFileTooLarge",
		status: error.status,
		method,
		serverMessage: error.serverMessage,
		context: { size },
		cause: error,
	});
};

export const createRecords = (transport: Transport, host?: HostModeSignal) => {
	const repoOf = (target: { repo?: string }) => target.repo ?? transport.did;

	const ownRepo = (target: { repo?: string }) => {
		return repoOf(target) === transport.did;
	};

	const hosted = async (target: { repo?: string; space?: string }) => {
		if (!host || !ownRepo(target)) return false;

		return (await host.route(target.space)) === "appview";
	};

	const routed = async <T>(
		target: { repo?: string; space?: string },
		pds: () => Promise<T>,
		appView: () => Promise<T>,
	): Promise<T> => {
		const run = async () => ((await hosted(target)) ? appView() : pds());

		try {
			return await run();
		} catch (error) {
			if (!host || !ownRepo(target) || !isHostMismatch(error)) throw error;

			if (
				target.space &&
				isRepoNotHosted(error) &&
				host.mode() === "migrating"
			) {
				host.markMoved(target.space);
			} else {
				await host.refresh();
			}

			return run();
		}
	};

	const pdsWrite = (
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

	const applyHosted = async (space: string, write: PolyfillWrite) => {
		const output = await transport.procedure(
			colibri.polyfill.applyWrites.main,
			{ body: { space, writes: [write] } as ApplyWritesInput },
		);

		return output.results[0];
	};

	const hostedWrite = async (
		kind: "create" | "update",
		target: SpaceTarget,
		record: Record<string, unknown>,
	) => {
		const result = await applyHosted(target.space, {
			$type: `social.colibri.beta.polyfill.applyWrites#${kind}`,
			collection: target.collection,
			rkey: target.rkey,
			value: { $type: target.collection, ...record },
		} as PolyfillWrite);

		return result && "uri" in result
			? { uri: result.uri, cid: result.cid }
			: { uri: "", cid: "" };
	};

	const hostedPut = async (
		target: SpaceTarget,
		record: Record<string, unknown>,
	) => {
		try {
			return await hostedWrite("update", target, record);
		} catch (error) {
			if (!isRecordMissing(error)) throw error;

			return hostedWrite("create", target, record);
		}
	};

	const pdsPage = (target: CollectionTarget, cursor: string | undefined) => {
		return transport.pdsQuery<ListedPage>("com.atproto.space.listRecords", {
			params: {
				space: target.space,
				repo: repoOf(target),
				collection: target.collection,
				limit: RECORD_PAGE,
				cursor,
			},
		});
	};

	const hostedPage = async (
		target: CollectionTarget,
		cursor: string | undefined,
	): Promise<ListedPage> => {
		const output = await transport.query(colibri.polyfill.listRecords.main, {
			params: {
				space: target.space,
				collection: target.collection,
				limit: HOSTED_RECORD_PAGE,
				cursor,
			},
		});

		return {
			cursor: output.cursor,
			records: output.records.map((view) => listedOf(target.collection, view)),
		};
	};

	const page = (target: CollectionTarget, cursor: string | undefined) => {
		return routed(
			target,
			() => pdsPage(target, cursor),
			() => hostedPage(target, cursor),
		);
	};

	const ignoreMissing = async (run: () => Promise<unknown>) => {
		try {
			await run();
		} catch (error) {
			if (isRecordMissing(error)) return;

			throw error;
		}
	};

	const pdsUpload = async (file: Blob, signal?: AbortSignal) => {
		try {
			const result = await transport.pdsProcedure<{ blob: BlobRef }>(
				"com.atproto.repo.uploadBlob",
				{ raw: rawOf(file), signal },
			);

			return result.blob;
		} catch (error) {
			throw tooLargeOf(error, "repo.uploadBlob", file.size);
		}
	};

	const hostedUpload = async (file: Blob, signal?: AbortSignal) => {
		try {
			const result = await transport.appViewProcedure<{ blob: BlobRef }>(
				colibri.polyfill.uploadBlob.main.nsid,
				{ raw: rawOf(file), signal },
			);

			return result.blob;
		} catch (error) {
			throw tooLargeOf(error, "polyfill.uploadBlob", file.size);
		}
	};

	return {
		createInSpace: (target: SpaceTarget, record: Record<string, unknown>) =>
			routed(
				target,
				() => pdsWrite("com.atproto.space.createRecord", target, record),
				() => hostedWrite("create", target, record),
			),
		putInSpace: (target: SpaceTarget, record: Record<string, unknown>) =>
			routed(
				target,
				() => pdsWrite("com.atproto.space.putRecord", target, record),
				() => hostedPut(target, record),
			),
		deleteInSpace: (target: SpaceTarget) =>
			routed(
				target,
				() =>
					ignoreMissing(() =>
						transport.pdsProcedure("com.atproto.space.deleteRecord", {
							body: {
								space: target.space,
								repo: repoOf(target),
								collection: target.collection,
								rkey: target.rkey,
							},
						}),
					),
				() =>
					ignoreMissing(() =>
						applyHosted(target.space, {
							$type: "social.colibri.beta.polyfill.applyWrites#delete",
							collection: target.collection,
							rkey: target.rkey,
						} as PolyfillWrite),
					),
			),
		getInSpace: (target: SpaceTarget) =>
			routed(
				target,
				() =>
					transport.pdsQuery<StoredRecord>("com.atproto.space.getRecord", {
						params: {
							space: target.space,
							repo: repoOf(target),
							collection: target.collection,
							rkey: target.rkey,
						},
					}),
				() =>
					transport.query(colibri.polyfill.getRecord.main, {
						params: {
							space: target.space,
							collection: target.collection,
							rkey: target.rkey,
						},
					}),
			),
		findInSpace: async (
			target: CollectionTarget,
			match: (value: Record<string, unknown>) => boolean,
		): Promise<SpaceListedRecord | undefined> => {
			let cursor: string | undefined;
			for (let index = 0; index < RECORD_SCAN_LIMIT; index++) {
				const result = await page(target, cursor);
				const hit = result.records.find((record) =>
					match((record.value ?? {}) as Record<string, unknown>),
				);
				if (hit) return hit;
				if (!result.cursor || result.records.length === 0) return undefined;
				cursor = result.cursor;
			}
			return undefined;
		},
		listInSpace: async (
			target: CollectionTarget,
		): Promise<SpaceListedRecord[]> => {
			const found: SpaceListedRecord[] = [];
			let cursor: string | undefined;
			for (let index = 0; index < RECORD_SCAN_LIMIT; index++) {
				const result = await page(target, cursor);
				found.push(...result.records);
				if (!result.cursor || result.records.length === 0) break;
				cursor = result.cursor;
			}
			return found;
		},
		listInRepo: async (collection: string): Promise<StoredRecord[]> => {
			const found: StoredRecord[] = [];
			let cursor: string | undefined;
			for (let page = 0; page < RECORD_SCAN_LIMIT; page++) {
				const result = await transport.pdsQuery<{
					cursor?: string;
					records: StoredRecord[];
				}>("com.atproto.repo.listRecords", {
					params: {
						repo: transport.did,
						collection,
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
				if (
					error instanceof ColibriError &&
					(error.status === 400 || error.status === 404)
				)
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
		deleteInRepo: async (collection: string, rkey: string) => {
			await transport.pdsProcedure("com.atproto.repo.deleteRecord", {
				body: { repo: transport.did, collection, rkey },
			});
		},
		uploadBlob: pdsUpload,
		uploadSpaceBlob: (file: Blob, signal?: AbortSignal) =>
			routed(
				{},
				() => pdsUpload(file, signal),
				() => hostedUpload(file, signal),
			),
	};
};

export type Records = ReturnType<typeof createRecords>;
