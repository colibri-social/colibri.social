import type { Agent } from "@atproto/api";
import { createSignal } from "solid-js";
import {
	classifyResponse,
	classifyThrown,
	parseRetryAfterMs,
	statusOf,
} from "../../errors/classify";
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
import { nextTid } from "./tid";
import type { AppviewKind, OutboxEntry, OutboxRecord } from "./types";

const MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

const [pendingCount, setPendingCount] = createSignal(0);
const [outboxRevision, setOutboxRevision] = createSignal(0);

export { outboxRevision, pendingCount };

export type QueuedRecord = {
	uri: string;
	rkey: string;
	kind: "create" | "put";
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

let appviewExecutor: ((kind: AppviewKind) => Promise<Response>) | null = null;

export const setAppviewExecutor = (
	executor: (kind: AppviewKind) => Promise<Response>,
): void => {
	appviewExecutor = executor;
};

type SentListener = (info: { uri: string; collection: string }) => void;
const sentListeners = new Set<SentListener>();

export const onOutboxSent = (listener: SentListener): (() => void) => {
	sentListeners.add(listener);
	return () => sentListeners.delete(listener);
};

const emitSent = (uri: string, collection: string) => {
	for (const listener of sentListeners) {
		try {
			listener({ uri, collection });
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

export const queuedRecords = (collection: string): QueuedRecord[] =>
	queue.flatMap((entry) => {
		const k = entry.kind;
		if (k.t !== "create" && k.t !== "put") return [];
		if (k.collection !== collection) return [];
		return [
			{
				uri: buildUri(k.repo, k.collection, k.rkey),
				rkey: k.rkey,
				kind: k.t,
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
	const k = entry.kind;
	if (k.t === "appview") {
		if (!appviewExecutor) return "retry";
		try {
			const res = await appviewExecutor(k);
			if (res.ok) return "success";
			retryAfterMs = parseRetryAfterMs(
				res.headers.get("retry-after"),
				Date.now(),
			);
			const body = await res.text().catch(() => "");
			lastFailure = classifyResponse({
				status: res.status,
				body,
				method: k.lxm,
				retryAfter: res.headers.get("retry-after"),
			});
			return lastFailure.retryable ? "retry" : "terminal";
		} catch (err) {
			lastFailure = classifyThrown(err, { method: k.lxm });
			return classify(err);
		}
	}
	if (!agent) return "retry";
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
		if (k.t === "delete") {
			const status = statusOf(err);
			if (
				status !== undefined &&
				status >= 400 &&
				status < 500 &&
				status !== 429
			)
				return "success";
		}
		lastFailure = classifyThrown(err, { method: `repo.${k.t}Record` });
		return classify(err);
	}
};

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
			} else if (
				outcome === "success" &&
				(entry.kind.t === "create" || entry.kind.t === "put")
			) {
				emitSent(
					buildUri(entry.kind.repo, entry.kind.collection, entry.kind.rkey),
					entry.kind.collection,
				);
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

export const enqueueAppview = async (params: {
	service: "appview" | "notif";
	lxm: string;
	route: string;
	method: string;
	label?: string;
}): Promise<void> => {
	await persist({
		owner: activeOwner(),
		kind: {
			t: "appview",
			service: params.service,
			lxm: params.lxm,
			route: params.route,
			method: params.method,
		},
		label: params.label,
		createdAt: Date.now(),
		attempts: 0,
	});
	scheduleFlush();
};
