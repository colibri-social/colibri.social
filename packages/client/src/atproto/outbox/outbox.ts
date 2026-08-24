import type { Agent } from "@atproto/api";
import { createSignal } from "solid-js";
import { classifyThrown, statusOf } from "../../errors/classify";
import type { ColibriError } from "../../errors/error";
import { reportError } from "../../errors/report";
import { showError } from "../../errors/show-error";
import { createLogger } from "../../utils/logger";
import {
	outboxAll,
	outboxAppend,
	outboxDelete,
	outboxUpdate,
} from "../cache/store";
import { sessionDead } from "../session-health";
import type { XrpcResult } from "../xrpc/result";
import { nextTid } from "./tid";
import {
	type AppviewKind,
	isSpaceKind,
	type OutboxEntry,
	type OutboxRecord,
} from "./types";

const MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

const [pendingCount, setPendingCount] = createSignal(0);
const [outboxRevision, setOutboxRevision] = createSignal(0);

export { outboxRevision, pendingCount };

export type QueuedRecord = {
	uri: string;
	rkey: string;
	kind: "create" | "put" | "spaceCreate" | "spacePut";
	space?: string;
	record: Record<string, unknown>;
	createdAt: number;
};

let agent: Agent | null = null;
let owner: string | null = null;
let queue: OutboxEntry[] = [];
let loaded = false;
let flushing = false;
let flushQueued = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

let appviewExecutor:
	| ((kind: AppviewKind) => Promise<XrpcResult<unknown>>)
	| null = null;

export const setAppviewExecutor = (
	executor: (kind: AppviewKind) => Promise<XrpcResult<unknown>>,
): void => {
	appviewExecutor = executor;
};

type SentListener = (info: {
	uri: string;
	collection: string;
	space?: string;
}) => void;
const sentListeners = new Set<SentListener>();

export const onOutboxSent = (listener: SentListener): (() => void) => {
	sentListeners.add(listener);
	return () => sentListeners.delete(listener);
};

const emitSent = (uri: string, collection: string, space?: string) => {
	for (const listener of sentListeners) {
		try {
			listener({ uri, collection, space });
		} catch {}
	}
};

const isOffline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false;

const sync = () => {
	setPendingCount(queue.length);
	setOutboxRevision((r) => r + 1);
};

const buildUri = (repo: string, collection: string, rkey: string) =>
	`at://${repo}/${collection}/${rkey}`;

const buildSpaceUri = (
	space: string,
	repo: string,
	collection: string,
	rkey: string,
) => `${space}/${repo}/${collection}/${rkey}`;

export const queuedRecords = (collection: string): QueuedRecord[] =>
	queue.flatMap((entry) => {
		const k = entry.kind;
		if (
			k.t !== "create" &&
			k.t !== "put" &&
			k.t !== "spaceCreate" &&
			k.t !== "spacePut"
		)
			return [];
		if (k.collection !== collection) return [];
		const uri =
			k.t === "spaceCreate" || k.t === "spacePut"
				? buildSpaceUri(k.space, k.repo, k.collection, k.rkey)
				: buildUri(k.repo, k.collection, k.rkey);
		return [
			{
				uri,
				rkey: k.rkey,
				kind: k.t,
				space:
					k.t === "spaceCreate" || k.t === "spacePut" ? k.space : undefined,
				record: k.record,
				createdAt: entry.createdAt,
			},
		];
	});

const toRecord = (entry: OutboxEntry): OutboxRecord => {
	const { seq: _seq, ...rest } = entry;
	return rest;
};

const backoff = (attempts: number): number => {
	const capped = Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
	return capped * (0.8 + Math.random() * 0.4);
};

const log = createLogger("outbox");

const classify = (err: unknown): "terminal" | "retry" => {
	if (isOffline()) return "retry";
	const status = statusOf(err);
	if (status === undefined) return "retry";
	return classifyThrown(err).retryable ? "retry" : "terminal";
};

let retryAfterMs: number | undefined;
let lastFailure: ColibriError | undefined;

const execute = async (
	entry: OutboxEntry,
): Promise<"success" | "terminal" | "retry"> => {
	lastFailure = undefined;
	retryAfterMs = undefined;

	const k = entry.kind;
	if (k.t === "appview") {
		if (!appviewExecutor) return "retry";
		try {
			const result = await appviewExecutor(k);
			if (result.ok) return "success";
			lastFailure = result.error;
			retryAfterMs = result.error.retryAfterMs;
			return result.error.retryable ? "retry" : "terminal";
		} catch (err) {
			lastFailure = classifyThrown(err, { method: k.lxm });
			return classify(err);
		}
	}
	if (!agent) return "retry";

	if (isSpaceKind(k)) {
		try {
			if (k.t === "spaceDelete") {
				await agent.com.atproto.space.deleteRecord({
					space: k.space,
					repo: k.repo,
					collection: k.collection,
					rkey: k.rkey,
				});
				return "success";
			}
			const write = {
				space: k.space,
				repo: k.repo,
				collection: k.collection,
				rkey: k.rkey,
				record: { $type: k.collection, ...k.record },
			};
			if (k.t === "spaceCreate") {
				await agent.com.atproto.space.createRecord(write);
			} else {
				await agent.com.atproto.space.putRecord(write);
			}
			return "success";
		} catch (err) {
			if (k.t === "spaceDelete" && goneAlready(err)) return "success";
			if (k.t === "spaceCreate" && alreadyExists(err)) return "success";
			const failure = classifyThrown(err, { method: `space.${k.t}` });
			if (acceptedWithBadReply(failure)) return "success";
			lastFailure = failure;
			return classify(err);
		}
	}

	try {
		if (k.t === "delete") {
			await agent.com.atproto.repo.deleteRecord({
				repo: k.repo,
				collection: k.collection,
				rkey: k.rkey,
			});
			return "success";
		}
		await agent.com.atproto.repo.putRecord({
			repo: k.repo,
			collection: k.collection,
			rkey: k.rkey,
			record: { $type: k.collection, ...k.record },
		});
		return "success";
	} catch (err) {
		if (k.t === "delete" && goneAlready(err)) return "success";
		const failure = classifyThrown(err, { method: `repo.${k.t}Record` });
		if (acceptedWithBadReply(failure)) return "success";
		lastFailure = failure;
		return classify(err);
	}
};

const acceptedWithBadReply = (failure: ColibriError): boolean => {
	if (failure.code !== "MalformedResponse") return false;
	log.warn("the write landed but the reply did not validate", {
		code: failure.code,
		reason: failure.serverMessage,
	});
	return true;
};

const goneAlready = (err: unknown): boolean => {
	const status = statusOf(err);
	return (
		status !== undefined && status >= 400 && status < 500 && status !== 429
	);
};

const alreadyExists = (err: unknown): boolean =>
	classifyThrown(err).serverMessage?.includes("RecordAlreadyExists") === true;

const heldForSignIn = (): boolean => sessionDead();

const surfaceTerminal = (entry: OutboxEntry) => {
	const failure = lastFailure ?? classifyThrown(new Error("gave up"));
	log.error("gave up on a queued write", {
		collection:
			entry.kind.t === "appview" ? entry.kind.lxm : entry.kind.collection,
		attempts: entry.attempts,
		code: failure.code,
	});
	reportError(failure, {
		stage: "outbox",
		tags: { "outbox.kind": entry.kind.t },
	});
	showError(failure, { fallbackTitle: entry.label, report: false });
};

const persist = async (record: OutboxRecord): Promise<OutboxEntry> => {
	const seq = await outboxAppend(record);
	const entry: OutboxEntry = { ...record, seq };
	queue.push(entry);
	sync();
	return entry;
};

const scheduleFlush = () => {
	if (flushQueued) return;
	flushQueued = true;
	setTimeout(() => {
		flushQueued = false;
		void flush();
	}, 0);
};

export const flush = async (): Promise<void> => {
	if (flushing || !agent || !owner || !loaded || isOffline()) return;
	if (heldForSignIn()) return;
	flushing = true;
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
	try {
		while (queue.length > 0) {
			if (isOffline()) break;
			const entry = queue[0]!;
			const outcome = await execute(entry);

			if (outcome === "retry") {
				entry.attempts += 1;
				if (entry.attempts < MAX_ATTEMPTS) {
					await outboxUpdate(entry.seq, toRecord(entry));
					retryTimer = setTimeout(() => {
						retryTimer = null;
						void flush();
					}, retryAfterMs ?? backoff(entry.attempts));
					retryAfterMs = undefined;
					break;
				}
			}

			if (outcome === "terminal" || entry.attempts >= MAX_ATTEMPTS) {
				if (heldForSignIn()) break;
				surfaceTerminal(entry);
			} else if (outcome === "success") {
				const k = entry.kind;
				if (k.t === "create" || k.t === "put") {
					emitSent(buildUri(k.repo, k.collection, k.rkey), k.collection);
				} else if (k.t === "spaceCreate" || k.t === "spacePut") {
					emitSent(
						buildSpaceUri(k.space, k.repo, k.collection, k.rkey),
						k.collection,
						k.space,
					);
				}
			}

			queue.shift();
			await outboxDelete(entry.seq);
			sync();
		}
	} finally {
		flushing = false;
	}
};

export const initOutbox = async (
	nextAgent: Agent,
	nextOwner: string,
): Promise<void> => {
	agent = nextAgent;
	if (owner === nextOwner && loaded) {
		void flush();
		return;
	}
	owner = nextOwner;
	loaded = false;
	const all = await outboxAll<OutboxRecord>();
	queue = all
		.filter((e) => e.entry.owner === nextOwner)
		.map((e) => ({ ...e.entry, seq: e.seq }));
	loaded = true;
	sync();
	void flush();
};

const activeOwner = () => owner ?? "";

export const enqueueCreate = async (
	repo: string,
	collection: string,
	record: Record<string, unknown>,
	opts?: { rkey?: string; label?: string },
): Promise<{ uri: string; rkey: string }> => {
	const rkey = opts?.rkey ?? nextTid();
	await persist({
		owner: activeOwner(),
		kind: { t: "create", repo, collection, rkey, record },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
	return { uri: buildUri(repo, collection, rkey), rkey };
};

export const enqueuePut = async (
	repo: string,
	collection: string,
	rkey: string,
	record: Record<string, unknown>,
	opts?: { label?: string },
): Promise<{ uri: string }> => {
	const existing = queue.find(
		(e) =>
			e.kind.t === "put" &&
			e.kind.collection === collection &&
			e.kind.rkey === rkey,
	);
	if (existing && existing.kind.t === "put") {
		existing.kind.record = record;
		existing.attempts = 0;
		await outboxUpdate(existing.seq, toRecord(existing));
		sync();
		scheduleFlush();
		return { uri: buildUri(repo, collection, rkey) };
	}
	await persist({
		owner: activeOwner(),
		kind: { t: "put", repo, collection, rkey, record },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
	return { uri: buildUri(repo, collection, rkey) };
};

export const enqueueDelete = async (
	repo: string,
	collection: string,
	rkey: string,
	opts?: { label?: string },
): Promise<void> => {
	const pendingCreate = queue.findIndex(
		(e) =>
			e.kind.t === "create" &&
			e.kind.collection === collection &&
			e.kind.rkey === rkey,
	);
	if (pendingCreate >= 0) {
		const [removed] = queue.splice(pendingCreate, 1);
		if (removed) await outboxDelete(removed.seq);
		sync();
		return;
	}
	await persist({
		owner: activeOwner(),
		kind: { t: "delete", repo, collection, rkey },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
};

export const enqueueSpaceCreate = async (
	space: string,
	repo: string,
	collection: string,
	record: Record<string, unknown>,
	opts?: { rkey?: string; label?: string },
): Promise<{ uri: string; rkey: string }> => {
	const rkey = opts?.rkey ?? nextTid();
	await persist({
		owner: activeOwner(),
		kind: { t: "spaceCreate", space, repo, collection, rkey, record },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
	return { uri: buildSpaceUri(space, repo, collection, rkey), rkey };
};

export const enqueueSpacePut = async (
	space: string,
	repo: string,
	collection: string,
	rkey: string,
	record: Record<string, unknown>,
	opts?: { label?: string },
): Promise<{ uri: string }> => {
	const existing = queue.find(
		(e) =>
			e.kind.t === "spacePut" &&
			e.kind.space === space &&
			e.kind.collection === collection &&
			e.kind.rkey === rkey,
	);
	if (existing && existing.kind.t === "spacePut") {
		existing.kind.record = record;
		existing.attempts = 0;
		await outboxUpdate(existing.seq, toRecord(existing));
		sync();
		scheduleFlush();
		return { uri: buildSpaceUri(space, repo, collection, rkey) };
	}
	await persist({
		owner: activeOwner(),
		kind: { t: "spacePut", space, repo, collection, rkey, record },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
	return { uri: buildSpaceUri(space, repo, collection, rkey) };
};

export const enqueueSpaceDelete = async (
	space: string,
	repo: string,
	collection: string,
	rkey: string,
	opts?: { label?: string },
): Promise<void> => {
	const pendingCreate = queue.findIndex(
		(e) =>
			e.kind.t === "spaceCreate" &&
			e.kind.space === space &&
			e.kind.collection === collection &&
			e.kind.rkey === rkey,
	);
	if (pendingCreate >= 0) {
		const [removed] = queue.splice(pendingCreate, 1);
		if (removed) await outboxDelete(removed.seq);
		sync();
		return;
	}
	await persist({
		owner: activeOwner(),
		kind: { t: "spaceDelete", space, repo, collection, rkey },
		label: opts?.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
};

export const enqueueAppview = async (params: {
	service: "appview" | "notif";
	lxm: string;
	input: Record<string, unknown>;
	label?: string;
}): Promise<void> => {
	await persist({
		owner: activeOwner(),
		kind: {
			t: "appview",
			service: params.service,
			lxm: params.lxm,
			input: params.input,
		},
		label: params.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
};
