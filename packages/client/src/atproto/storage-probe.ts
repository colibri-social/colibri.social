const PROBE_TIMEOUT_MS = 3_000;
const OAUTH_DB_NAME = "@atproto-oauth-client";
const OAUTH_DB_STORE = "state";
const SCRATCH_DB_NAME = "colibri-storage-probe";
const SCRATCH_DB_STORE = "probe";
const PROBE_KEY = "__colibri_probe__";

export type ProbeStatus =
	| "ok"
	| "timeout"
	| "blocked"
	| "error"
	| "unavailable"
	| "absent";

export type ProbeResult = {
	status: ProbeStatus;
	ms: number;
	detail?: string;
};

export type StorageProbe = {
	scratch: ProbeResult;
	oauthDb: ProbeResult;
};

const describe = (err: unknown): string => {
	if (err instanceof DOMException) return `${err.name}: ${err.message}`;
	if (err instanceof Error) return err.message;
	return String(err);
};

const timed = async (
	run: (signal: { aborted: boolean }) => Promise<ProbeResult>,
): Promise<ProbeResult> => {
	const startedAt = Date.now();
	const state = { aborted: false };

	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<ProbeResult>((resolve) => {
		timer = setTimeout(() => {
			state.aborted = true;
			resolve({ status: "timeout", ms: Date.now() - startedAt });
		}, PROBE_TIMEOUT_MS);
	});

	try {
		return await Promise.race([
			run(state).catch((err) => ({
				status: "error" as ProbeStatus,
				ms: Date.now() - startedAt,
				detail: describe(err),
			})),
			timeout,
		]);
	} finally {
		clearTimeout(timer);
	}
};

const awaitRequest = <T>(request: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("request failed"));
	});

const openExisting = (
	name: string,
): Promise<{ db: IDBDatabase } | { blocked: true }> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => resolve({ db: request.result });
		request.onerror = () => reject(request.error ?? new Error("open failed"));
		request.onblocked = () => resolve({ blocked: true });
		request.onupgradeneeded = () => {
			request.transaction?.abort();
			reject(new Error("database did not exist"));
		};
	});

const probeOauthDatabase = async (): Promise<ProbeResult> =>
	timed(async (state) => {
		const startedAt = Date.now();

		if (typeof indexedDB === "undefined") {
			return { status: "unavailable", ms: 0 };
		}

		if (typeof indexedDB.databases === "function") {
			const existing = await indexedDB.databases();
			if (!existing.some((entry) => entry.name === OAUTH_DB_NAME)) {
				return { status: "absent", ms: Date.now() - startedAt };
			}
		} else {
			return {
				status: "unavailable",
				ms: Date.now() - startedAt,
				detail: "indexedDB.databases() unsupported",
			};
		}

		const opened = await openExisting(OAUTH_DB_NAME);
		if ("blocked" in opened) {
			return { status: "blocked", ms: Date.now() - startedAt };
		}

		const { db } = opened;
		try {
			if (state.aborted) {
				return { status: "timeout", ms: Date.now() - startedAt };
			}
			if (!db.objectStoreNames.contains(OAUTH_DB_STORE)) {
				return {
					status: "error",
					ms: Date.now() - startedAt,
					detail: `missing store ${OAUTH_DB_STORE}`,
				};
			}

			const tx = db.transaction([OAUTH_DB_STORE], "readonly");
			const settled = new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
				tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
			});

			await awaitRequest(tx.objectStore(OAUTH_DB_STORE).get(PROBE_KEY));
			await settled;

			return { status: "ok", ms: Date.now() - startedAt };
		} finally {
			db.close();
		}
	});

const probeScratchDatabase = async (): Promise<ProbeResult> =>
	timed(async (state) => {
		const startedAt = Date.now();

		if (typeof indexedDB === "undefined") {
			return { status: "unavailable", ms: 0 };
		}

		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(SCRATCH_DB_NAME, 1);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? new Error("open failed"));
			request.onblocked = () => reject(new Error("open blocked"));
			request.onupgradeneeded = () => {
				const upgrading = request.result;
				if (!upgrading.objectStoreNames.contains(SCRATCH_DB_STORE)) {
					upgrading.createObjectStore(SCRATCH_DB_STORE);
				}
			};
		});

		try {
			if (state.aborted) {
				return { status: "timeout", ms: Date.now() - startedAt };
			}

			const tx = db.transaction([SCRATCH_DB_STORE], "readwrite");
			const settled = new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
				tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
			});

			const store = tx.objectStore(SCRATCH_DB_STORE);
			await awaitRequest(store.put({ at: Date.now() }, PROBE_KEY));
			const readBack = await awaitRequest(store.get(PROBE_KEY));
			await settled;

			if (!readBack) {
				return {
					status: "error",
					ms: Date.now() - startedAt,
					detail: "write did not persist",
				};
			}

			return { status: "ok", ms: Date.now() - startedAt };
		} finally {
			db.close();
		}
	});

export const probeStorage = async (): Promise<StorageProbe> => {
	const [scratch, oauthDb] = await Promise.all([
		probeScratchDatabase(),
		probeOauthDatabase(),
	]);

	return { scratch, oauthDb };
};

export const probeIndicatesStall = (probe: StorageProbe | undefined): boolean =>
	probe !== undefined &&
	(["timeout", "blocked"] as Array<ProbeStatus>).some(
		(status) =>
			probe.scratch.status === status || probe.oauthDb.status === status,
	);

export const summarizeProbe = (probe: StorageProbe): string =>
	`scratch=${probe.scratch.status}/${probe.scratch.ms}ms oauthDb=${probe.oauthDb.status}/${probe.oauthDb.ms}ms`;
