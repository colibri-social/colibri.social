import { createKvStore, createLogger, type KvStore } from "@colibri-social/lib";
import type { OutboxEntry, OutboxQueue } from "./types";

const log = createLogger("outbox");

export const OUTBOX_DB_NAME = "colibri-app-outbox";
const OUTBOX_DB_VERSION = 1;
const ENTRIES = "entries";

let shared: KvStore | undefined;
const sharedOutboxStore = () => {
	shared ??= createKvStore({
		name: OUTBOX_DB_NAME,
		version: OUTBOX_DB_VERSION,
		stores: [ENTRIES],
		onFailure: (error) =>
			log.warn("unsent messages can't be kept on this device", {
				code: error.code,
			}),
	});
	return shared;
};

const keyFor = (owner: string, seq: number) =>
	`${owner}|${String(seq).padStart(16, "0")}`;

const withoutSessionUploads = (entry: OutboxEntry): OutboxEntry =>
	entry.op.t === "send"
		? {
				...entry,
				op: {
					...entry.op,
					files: entry.op.files.map(
						({ attachment: _attachment, ...file }) => file,
					),
				},
			}
		: entry;

export const createOutboxQueue = (options: {
	owner: string;
	kv?: KvStore;
}): OutboxQueue => {
	const kv = options.kv ?? sharedOutboxStore();
	const prefix = `${options.owner}|`;
	return {
		load: async () =>
			(await kv.values<OutboxEntry>(ENTRIES, prefix)).map(
				withoutSessionUploads,
			),
		put: (entry) =>
			kv.put(
				ENTRIES,
				keyFor(options.owner, entry.seq),
				withoutSessionUploads(entry),
			),
		remove: (seq) => kv.remove(ENTRIES, keyFor(options.owner, seq)),
	};
};

export const createMemoryQueue = (): OutboxQueue => ({
	load: async () => [],
	put: async () => {},
	remove: async () => {},
});
