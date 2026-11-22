import type { social } from "@colibri-social/lexicons";
import {
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
} from "@colibri-social/lib";
import type { Transport } from "../remote/transport";
import {
	type HostModeSignal,
	type HostStatus,
	isHostedByAppView,
} from "./host-mode";

export type MigrationRecord = social.colibri.beta.polyfill.defs.MigrationRecord;

const log = createLogger("polyfill/migrator");

const BATCH_SIZE = 50;
const HOSTED_PAGE = 200;
const NATIVE_PAGE = 1000;
const MAX_ATTEMPTS = 6;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 300_000;

const APPLY_WRITES = "com.atproto.space.applyWrites";
const LIST_NATIVE = "com.atproto.space.listRecords";
const UPLOAD_BLOB = "com.atproto.repo.uploadBlob";
const MISSING_REPO = new Set(["SpaceNotFound", "RepoNotFound", "NotFound"]);

type NativeWrite =
	| {
			$type:
				| "com.atproto.space.applyWrites#create"
				| "com.atproto.space.applyWrites#update";
			collection: string;
			rkey: string;
			value: unknown;
	  }
	| {
			$type: "com.atproto.space.applyWrites#delete";
			collection: string;
			rkey: string;
	  };

type NativeListing = {
	cursor?: string;
	records: Array<{ collection: string; rkey: string; cid: string }>;
};

type MigrationSpace = { space: string; create: () => Promise<void> };

type PreferencesAccess = () => Promise<boolean>;

export type MigratorDeps = {
	transport: Transport;
	host: HostModeSignal;
	preferencesSpace: MigrationSpace;
	grantPreferences: PreferencesAccess;
	wait?: (ms: number) => Promise<void>;
};

const shouldMigrate = (status: HostStatus) => {
	return isHostedByAppView(status.mode) && status.pdsSupportsSpaces;
};

const migrationRetryDelay = (attempt: number) => {
	return Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
};

const keyOf = (record: { collection: string; rkey: string }) => {
	return `${record.collection}/${record.rkey}`;
};

const collectBlobs = (value: unknown, found: Map<string, string>) => {
	if (Array.isArray(value)) {
		for (const item of value) collectBlobs(item, found);
		return;
	}

	if (!value || typeof value !== "object") return;

	const node = value as Record<string, unknown>;
	const link = (node.ref as { $link?: unknown } | undefined)?.$link;

	if (node.$type === "blob" && typeof link === "string") {
		found.set(link, typeof node.mimeType === "string" ? node.mimeType : "");
		return;
	}

	for (const child of Object.values(node)) collectBlobs(child, found);
};

const unknownCodeOf = (error: unknown) => {
	if (!(error instanceof ColibriError)) return undefined;

	const code = error.context.unknownCode;

	return typeof code === "string" ? code : undefined;
};

const isMissingRepo = (error: unknown) => {
	if (!(error instanceof ColibriError)) return false;

	return (
		MISSING_REPO.has(error.code) || MISSING_REPO.has(unknownCodeOf(error) ?? "")
	);
};

const defaultWait = (ms: number) => {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
};

export const createMigrator = (deps: MigratorDeps) => {
	const { transport, host, preferencesSpace, grantPreferences } = deps;
	const wait = deps.wait ?? defaultWait;
	const uploaded = new Set<string>();
	let started = false;
	let stopped = false;

	const listHosted = async (space: string) => {
		const records: MigrationRecord[] = [];
		let cursor: string | undefined;

		do {
			const page = await transport.query(
				colibri.polyfill.listForMigration.main,
				{ params: { space, limit: HOSTED_PAGE, cursor } },
			);

			records.push(...page.records);
			cursor = page.records.length > 0 ? page.cursor : undefined;
		} while (cursor && !stopped);

		return records;
	};

	const listNative = async (space: string) => {
		const found = new Map<string, string>();
		let cursor: string | undefined;

		try {
			do {
				const page = await transport.pdsQuery<NativeListing>(LIST_NATIVE, {
					params: {
						space,
						repo: transport.did,
						limit: NATIVE_PAGE,
						excludeValues: true,
						cursor,
					},
				});

				for (const record of page.records) found.set(keyOf(record), record.cid);

				cursor = page.records.length > 0 ? page.cursor : undefined;
			} while (cursor && !stopped);
		} catch (error) {
			if (isMissingRepo(error)) return found;

			throw error;
		}

		return found;
	};

	const copyBlobs = async (records: MigrationRecord[]) => {
		const blobs = new Map<string, string>();

		for (const record of records) collectBlobs(record.value, blobs);

		for (const [cid, mimeType] of blobs) {
			if (stopped) return;
			if (uploaded.has(cid)) continue;

			const data = await transport.appViewBlob(
				colibri.polyfill.getBlob.main.nsid,
				{ cid },
			);

			await transport.pdsProcedure(UPLOAD_BLOB, {
				raw: {
					data,
					encoding: mimeType || data.type || "application/octet-stream",
				},
			});

			uploaded.add(cid);
		}
	};

	const replay = async (space: string) => {
		const [hosted, native] = await Promise.all([
			listHosted(space),
			listNative(space),
		]);
		const kept = new Set<string>();
		const pending: MigrationRecord[] = [];
		const writes: NativeWrite[] = [];

		for (const record of hosted) {
			const key = keyOf(record);
			const existing = native.get(key);

			kept.add(key);

			if (existing === record.cid) continue;

			pending.push(record);
			writes.push({
				$type: existing
					? "com.atproto.space.applyWrites#update"
					: "com.atproto.space.applyWrites#create",
				collection: record.collection,
				rkey: record.rkey,
				value: record.value,
			});
		}

		for (const key of native.keys()) {
			if (kept.has(key)) continue;

			const split = key.indexOf("/");

			writes.push({
				$type: "com.atproto.space.applyWrites#delete",
				collection: key.slice(0, split),
				rkey: key.slice(split + 1),
			});
		}

		await copyBlobs(pending);

		for (let from = 0; from < writes.length && !stopped; from += BATCH_SIZE) {
			await transport.pdsProcedure(APPLY_WRITES, {
				body: {
					space,
					repo: transport.did,
					writes: writes.slice(from, from + BATCH_SIZE),
				},
			});
		}
	};

	const complete = async (space: string) => {
		try {
			const output = await transport.procedure(
				colibri.polyfill.completeMigration.main,
				{ body: { space } },
			);

			return output.mode !== "polyfill" && !output.missing?.length;
		} catch (error) {
			if (unknownCodeOf(error) === "VerificationFailed") return false;

			throw error;
		}
	};

	const begin = () => {
		return transport.procedure(colibri.polyfill.beginMigration.main, {
			body: {},
		});
	};

	const grantIfPreferences = async (space: string) => {
		if (space !== preferencesSpace.space) return;
		if (await grantPreferences()) return;

		throw new ColibriError({
			code: "Unexpected",
			method: colibri.polyfill.completeMigration.main.nsid,
			message: "Colibri could not get access to the copied preferences",
		});
	};

	const settle = async (space: string) => {
		await grantIfPreferences(space);

		const matched = await complete(space);

		if (matched) host.markMoved(space);

		return matched;
	};

	const migrateSpace = async (space: string) => {
		if (space === preferencesSpace.space) await preferencesSpace.create();

		await replay(space);

		if (stopped || (await settle(space))) return;

		log.warn("a copied space did not match, copying the difference again");

		await begin();
		await replay(space);

		if (stopped || (await settle(space))) return;

		throw new ColibriError({
			code: "Unexpected",
			method: colibri.polyfill.completeMigration.main.nsid,
			message: "The copied space did not match after a second try",
		});
	};

	const report = (spacesTotal: number, spacesDone: number) => {
		if (stopped) return;

		host.apply({
			mode: "migrating",
			pdsSupportsSpaces: true,
			migration: { spacesTotal, spacesDone },
		});
	};

	const pass = async () => {
		const { spaces } = await begin();
		const total = Math.max(
			host.status()?.migration?.spacesTotal ?? 0,
			spaces.length,
		);
		let done = total - spaces.length;

		report(total, done);

		for (const space of spaces) {
			if (stopped) return;

			await migrateSpace(space);

			done += 1;
			report(total, done);
		}

		if (stopped) return;

		const status = await host.refresh();

		if (status.mode !== "native")
			throw new ColibriError({
				code: "Unexpected",
				method: colibri.polyfill.getStatus.main.nsid,
				message: "The account's data has not finished moving",
			});
	};

	const run = async () => {
		for (let attempt = 1; attempt <= MAX_ATTEMPTS && !stopped; attempt++) {
			try {
				await pass();

				return;
			} catch (error) {
				const failure = classifyThrown(error, {
					method: colibri.polyfill.beginMigration.main.nsid,
				});

				log.warn("moving the account's data to its provider failed", {
					code: failure.code,
					attempt,
				});

				if (failure.code === "SpacesUnsupported") {
					await host.refresh();

					return;
				}

				await wait(migrationRetryDelay(attempt));
			}
		}
	};

	const consider = (status: HostStatus) => {
		if (stopped || started || !shouldMigrate(status)) return;

		started = true;
		void run();
	};

	const start = () => {
		const unsubscribe = host.subscribe(consider);
		const current = host.status();

		if (current) consider(current);

		return () => {
			stopped = true;
			unsubscribe();
		};
	};

	return { start };
};
