import type { Agent } from "@atproto/api";
import type { JsonBlobRef } from "@atproto/lexicon";
import { createSignal } from "solid-js";
import { classifyThrown, statusOf } from "../../errors/classify";
import type { ColibriError } from "../../errors/error";
import { reportError } from "../../errors/report";
import { showError } from "../../errors/show-error";
import { createLogger } from "../../utils/logger";
import {
	sendsAll,
	sendsAppend,
	sendsDelete,
	sendsUpdate,
} from "../cache/store";
import { asUri, COLLECTIONS } from "../lexicons";
import { buildMessageRecord } from "../message-record";
import { uploadBlob } from "../pds";
import { sessionDead } from "../session-health";
import type {
	AttachmentView,
	Facet,
	MessageAttachment,
	RecordRef,
} from "../views";
import { enqueueSpaceCreate, onOutboxSent, type QueuedRecord } from "./outbox";
import { nextTid } from "./tid";

const MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;
const UPLOAD_CONCURRENCY = 3;

export const MAX_QUEUED_BYTES = 256 * 1024 * 1024;

const [sendsRevision, setSendsRevision] = createSignal(0);

export { sendsRevision };

export type SendFile = { file: File; blob?: JsonBlobRef };

export type SendRecord = {
	owner: string;
	space: string;
	repo: string;
	rkey: string;
	text: string;
	facets: Facet[];
	parent?: RecordRef;
	suppressedEmbeds: string[];
	files: SendFile[];
	createdAt: number;
	attempts: number;
	failed?: boolean;
};

export type SendEntry = SendRecord & { seq: number };

export type SendProgress = { uploaded: number; total: number; failed: boolean };

export type EnqueueMessageSendInput = {
	space: string;
	repo: string;
	text: string;
	facets: Facet[];
	files: ReadonlyArray<File>;
	parent?: RecordRef;
	suppressedEmbeds: ReadonlyArray<string>;
};

export type EnqueueMessageSendResult =
	| { ok: true; rkey: string }
	| { ok: false; reason: "tooLarge" };

const log = createLogger("sends");

let agent: Agent | null = null;
let owner: string | null = null;
let queue: SendEntry[] = [];
let loaded = false;
let flushing = false;
let flushQueued = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopOutboxWatch: (() => void) | null = null;

type DiscardListener = (rkey: string) => void;
const discardListeners = new Set<DiscardListener>();

export const onSendDiscarded = (listener: DiscardListener): (() => void) => {
	discardListeners.add(listener);
	return () => discardListeners.delete(listener);
};

const previews = new Map<string, AttachmentView[]>();

const isOffline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false;

const heldForSignIn = (): boolean => sessionDead();

const sync = () => setSendsRevision((r) => r + 1);

const toRecord = (entry: SendEntry): SendRecord => {
	const { seq: _seq, ...rest } = entry;
	return rest;
};

const backoff = (attempts: number): number => {
	const capped = Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
	return capped * (0.8 + Math.random() * 0.4);
};

const classify = (err: unknown): "terminal" | "retry" => {
	if (isOffline()) return "retry";
	const status = statusOf(err);
	if (status === undefined) return "retry";
	return classifyThrown(err).retryable ? "retry" : "terminal";
};

const buildPreviews = (entry: SendRecord): AttachmentView[] =>
	entry.files.map(
		({ file }) =>
			({
				url: asUri(URL.createObjectURL(file)),
				mimeType: file.type,
				name: file.name,
				size: file.size,
			}) as AttachmentView,
	);

const ensurePreviews = (entry: SendRecord): AttachmentView[] => {
	const existing = previews.get(entry.rkey);
	if (existing) return existing;
	const built = buildPreviews(entry);
	previews.set(entry.rkey, built);
	return built;
};

const releasePreviews = (rkey: string) => {
	const held = previews.get(rkey);
	if (!held) return;
	for (const attachment of held) {
		try {
			URL.revokeObjectURL(attachment.url);
		} catch {}
	}
	previews.delete(rkey);
};

const queuedBytes = (): number =>
	queue.reduce(
		(total, entry) =>
			total + entry.files.reduce((sum, { file }) => sum + file.size, 0),
		0,
	);

export const pendingSends = (space: string): QueuedRecord[] =>
	queue
		.filter((entry) => entry.space === space)
		.map((entry) => ({
			uri: `${entry.space}/${entry.repo}/${COLLECTIONS.message}/${entry.rkey}`,
			rkey: entry.rkey,
			kind: "spaceCreate" as const,
			space: entry.space,
			record: {
				text: entry.text,
				facets: entry.facets,
				createdAt: new Date(entry.createdAt).toISOString(),
				attachments: ensurePreviews(entry),
				...(entry.parent ? { parent: entry.parent } : {}),
			},
			createdAt: entry.createdAt,
			failed: entry.failed === true,
		}));

export const sendProgress = (rkey: string): SendProgress | undefined => {
	const entry = queue.find((e) => e.rkey === rkey);
	if (!entry) return undefined;
	return {
		uploaded: entry.files.filter((f) => f.blob !== undefined).length,
		total: entry.files.length,
		failed: entry.failed === true,
	};
};

const scheduleFlush = () => {
	if (flushQueued) return;
	flushQueued = true;
	setTimeout(() => {
		flushQueued = false;
		void flushSends();
	}, 0);
};

const removeEntry = async (entry: SendEntry, keepPreviews = false) => {
	const index = queue.indexOf(entry);
	if (index >= 0) queue.splice(index, 1);
	if (!keepPreviews) releasePreviews(entry.rkey);
	await sendsDelete(entry.seq);
	sync();
};

let lastFailure: ColibriError | undefined;

const uploadMissing = async (
	entry: SendEntry,
): Promise<"success" | "terminal" | "retry"> => {
	if (!agent) return "retry";
	const pending = entry.files.filter((f) => f.blob === undefined);
	if (pending.length === 0) return "success";

	let cursor = 0;
	let outcome: "success" | "terminal" | "retry" = "success";

	const worker = async () => {
		while (cursor < pending.length && outcome !== "terminal") {
			const target = pending[cursor++]!;
			try {
				const blob = await uploadBlob(agent!, target.file);
				target.blob = blob.toJSON() as unknown as JsonBlobRef;
				await sendsUpdate(entry.seq, toRecord(entry));
				sync();
			} catch (err) {
				const failure = classifyThrown(err, { method: "repo.uploadBlob" });
				lastFailure = failure;
				const verdict = classify(err);
				if (verdict === "terminal" || outcome === "success") outcome = verdict;
			}
		}
	};

	await Promise.all(
		Array.from(
			{ length: Math.min(UPLOAD_CONCURRENCY, pending.length) },
			worker,
		),
	);

	return outcome;
};

const runSend = async (
	entry: SendEntry,
): Promise<"success" | "terminal" | "retry" | "discarded"> => {
	lastFailure = undefined;

	const uploaded = await uploadMissing(entry);
	if (uploaded !== "success") return uploaded;
	if (!queue.includes(entry)) return "discarded";

	const attachments: MessageAttachment[] = entry.files.map(
		({ file, blob }) =>
			({ blob: blob as JsonBlobRef, name: file.name }) as MessageAttachment,
	);

	const record = buildMessageRecord({
		text: entry.text,
		facets: entry.facets,
		createdAt: new Date(entry.createdAt).toISOString(),
		parent: entry.parent,
		attachments,
		suppressedEmbeds: entry.suppressedEmbeds,
	});

	try {
		await enqueueSpaceCreate(
			entry.space,
			entry.repo,
			COLLECTIONS.message,
			record,
			{ rkey: entry.rkey, label: "Failed to send message." },
		);
		return "success";
	} catch (err) {
		lastFailure = classifyThrown(err, { method: "sends.handoff" });
		return classify(err);
	}
};

const surfaceTerminal = (entry: SendEntry) => {
	const failure = lastFailure ?? classifyThrown(new Error("gave up"));
	log.error("gave up on a queued message with attachments", {
		attempts: entry.attempts,
		files: entry.files.length,
		code: failure.code,
	});
	reportError(failure, { stage: "sends" });
	showError(failure, {
		fallbackTitle: "Failed to send message.",
		report: false,
	});
};

export const flushSends = async (): Promise<void> => {
	if (flushing || !agent || !owner || !loaded || isOffline()) return;
	if (heldForSignIn()) return;
	flushing = true;
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
	try {
		while (!isOffline()) {
			const entry = queue.find((e) => e.failed !== true);
			if (!entry) break;

			const outcome = await runSend(entry);
			if (outcome === "discarded") continue;
			if (outcome === "success") {
				await removeEntry(entry, true);
				continue;
			}

			if (outcome === "retry") {
				entry.attempts += 1;
				if (entry.attempts < MAX_ATTEMPTS) {
					await sendsUpdate(entry.seq, toRecord(entry));
					retryTimer = setTimeout(() => {
						retryTimer = null;
						void flushSends();
					}, backoff(entry.attempts));
					break;
				}
			}

			if (heldForSignIn()) break;
			entry.failed = true;
			await sendsUpdate(entry.seq, toRecord(entry));
			sync();
			surfaceTerminal(entry);
		}
	} finally {
		flushing = false;
	}
};

export const initSends = async (
	nextAgent: Agent,
	nextOwner: string,
): Promise<void> => {
	agent = nextAgent;
	if (owner === nextOwner && loaded) {
		void flushSends();
		return;
	}
	owner = nextOwner;
	loaded = false;
	for (const rkey of [...previews.keys()]) releasePreviews(rkey);
	stopOutboxWatch?.();
	stopOutboxWatch = onOutboxSent(({ uri }) =>
		releasePreviews(uri.slice(uri.lastIndexOf("/") + 1)),
	);
	const all = await sendsAll<SendRecord>();
	queue = all
		.filter((e) => e.entry.owner === nextOwner)
		.map((e) => ({ ...e.entry, seq: e.seq }));
	loaded = true;
	sync();
	void flushSends();
};

export const enqueueMessageSend = async (
	input: EnqueueMessageSendInput,
): Promise<EnqueueMessageSendResult> => {
	const incoming = input.files.reduce((sum, file) => sum + file.size, 0);
	if (queuedBytes() + incoming > MAX_QUEUED_BYTES) {
		return { ok: false, reason: "tooLarge" };
	}

	const rkey = nextTid();
	const record: SendRecord = {
		owner: owner ?? "",
		space: input.space,
		repo: input.repo,
		rkey,
		text: input.text,
		facets: input.facets,
		suppressedEmbeds: [...input.suppressedEmbeds],
		files: input.files.map((file) => ({ file })),
		createdAt: Date.now(),
		attempts: 0,
		...(input.parent ? { parent: input.parent } : {}),
	};

	const seq = await sendsAppend(record);
	queue.push({ ...record, seq });
	sync();
	scheduleFlush();

	return { ok: true, rkey };
};

export const retrySend = (rkey: string): void => {
	const entry = queue.find((e) => e.rkey === rkey);
	if (!entry) return;
	entry.failed = false;
	entry.attempts = 0;
	void sendsUpdate(entry.seq, toRecord(entry));
	sync();
	scheduleFlush();
};

export const discardSend = (rkey: string): void => {
	const entry = queue.find((e) => e.rkey === rkey);
	if (!entry) return;
	void removeEntry(entry);
	for (const listener of discardListeners) {
		try {
			listener(rkey);
		} catch {}
	}
};
