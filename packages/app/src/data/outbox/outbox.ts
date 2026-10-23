import {
	ColibriError,
	classifyThrown,
	createLogger,
	isOffline,
	nextTid,
	retryability,
	tidMillis,
} from "@colibri-social/lib";
import { createSignal } from "solid-js";
import type { DataSource } from "../source";
import type { AttachmentView, MessageView, SpaceRef } from "../types";
import { createMemoryQueue } from "./queue";
import type {
	OutboxEntry,
	OutboxEvent,
	OutboxOp,
	OutboxQueue,
	OutboxResult,
	OutboxTicket,
	QueuedFile,
} from "./types";

const log = createLogger("outbox");

export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_RETRY_BASE_MS = 2_000;
export const OUTBOX_RETRY_MAX_MS = 60_000;
export const OUTBOX_MAX_QUEUED_BYTES = 256 * 1024 * 1024;
export const OUTBOX_BLOB_REF_TTL_MS = 10 * 60 * 1000;
export const OUTBOX_SEND_KEY_MAX_AGE_MS = 23 * 60 * 60 * 1000;
const UPLOAD_CONCURRENCY = 3;

type SendOp = Extract<OutboxOp, { t: "send" }>;
type Waiter = {
	resolve: (result: OutboxResult) => void;
	reject: (error: ColibriError) => void;
};

export type OutboxOptions = {
	source: Pick<
		DataSource,
		| "sendMessage"
		| "editMessage"
		| "deleteMessage"
		| "react"
		| "forwardMessage"
		| "deleteThread"
		| "uploadBlob"
	>;
	queue?: OutboxQueue;
	held?: () => boolean;
	online?: () => boolean;
	random?: () => number;
	now?: () => number;
	watch?: boolean;
};

export const outboxBackoff = (attempts: number, random: () => number) =>
	Math.min(OUTBOX_RETRY_BASE_MS * 2 ** (attempts - 1), OUTBOX_RETRY_MAX_MS) *
	(0.8 + random() * 0.4);

const isRemoval = (op: OutboxOp) =>
	op.t === "delete" || op.t === "deleteThread" || (op.t === "react" && !op.add);

const isCreation = (op: OutboxOp) =>
	op.t === "send" || op.t === "forward" || (op.t === "react" && op.add);

const landedAnyway = (op: OutboxOp, error: ColibriError) =>
	error.code === "MalformedResponse" ||
	(isRemoval(op) && error.code.endsWith("NotFound")) ||
	(isCreation(op) && error.code === "AlreadyExists");

const targets = (op: OutboxOp, channel: SpaceRef, rkey: string) =>
	(op.t === "send" ||
		op.t === "edit" ||
		op.t === "delete" ||
		op.t === "react") &&
	op.channel === channel &&
	op.rkey === rkey;

const staleKey = (rkey: string, at: number) => {
	const minted = tidMillis(rkey);
	return minted !== undefined && at - minted > OUTBOX_SEND_KEY_MAX_AGE_MS;
};

const withMovedKey = (
	op: OutboxOp,
	channel: SpaceRef,
	from: string,
	to: string,
): OutboxOp => {
	switch (op.t) {
		case "send":
			if (op.channel !== channel) return op;
			if (op.rkey !== from && op.parent !== from) return op;
			return {
				...op,
				...(op.rkey === from ? { rkey: to } : {}),
				...(op.parent === from ? { parent: to } : {}),
			};
		case "edit":
		case "delete":
		case "react":
			return op.channel === channel && op.rkey === from
				? { ...op, rkey: to }
				: op;
		case "forward":
			return op.from === channel && op.rkey === from ? { ...op, rkey: to } : op;
		case "deleteThread":
			return op;
	}
};

const bytesOf = (op: OutboxOp) =>
	op.t === "send"
		? op.files.reduce((total, file) => total + file.file.size, 0)
		: 0;

const withoutUploads = (files: readonly QueuedFile[]): QueuedFile[] =>
	files.map(({ file, spoiler, alt }) => ({
		file,
		...(spoiler ? { spoiler: true } : {}),
		...(alt ? { alt } : {}),
	}));

const withAttachment = (
	file: QueuedFile,
	uploaded: AttachmentView,
): AttachmentView => ({
	...uploaded,
	...(file.spoiler ? { spoiler: true } : {}),
	...(file.alt ? { alt: file.alt } : {}),
});

export const createOutbox = (options: OutboxOptions) => {
	const source = options.source;
	const queue = options.queue ?? createMemoryQueue();
	const held = options.held ?? (() => false);
	const online = options.online ?? (() => !isOffline());
	const random = options.random ?? Math.random;
	const now = options.now ?? Date.now;
	const [entries, setEntries] = createSignal<readonly OutboxEntry[]>([]);
	const listeners = new Set<(event: OutboxEvent) => void>();
	const waiters = new Map<number, Waiter[]>();
	const idleChecks = new Set<() => void>();
	let lastSeq = 0;
	let inFlight: number | undefined;
	const abandoned = new Set<number>();
	let running = false;
	let again = false;
	let disposed = false;
	let notBefore = 0;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const emit = (event: OutboxEvent) => {
		for (const listener of [...listeners]) listener(event);
	};
	const changed = () => {
		for (const check of [...idleChecks]) check();
	};
	const find = (seq: number) => entries().find((entry) => entry.seq === seq);
	const save = (entry: OutboxEntry) => {
		void queue.put(entry).catch(() => undefined);
	};
	const replace = (entry: OutboxEntry, persist = true) => {
		setEntries((list) =>
			list.map((item) => (item.seq === entry.seq ? entry : item)),
		);
		if (persist) save(entry);
	};
	const remove = (seq: number) => {
		setEntries((list) => list.filter((item) => item.seq !== seq));
		void queue.remove(seq).catch(() => undefined);
		changed();
	};
	const settle = (seq: number, outcome: OutboxResult | ColibriError) => {
		const pending = waiters.get(seq);
		waiters.delete(seq);
		for (const waiter of pending ?? []) {
			if (outcome instanceof ColibriError) waiter.reject(outcome);
			else waiter.resolve(outcome);
		}
	};
	const ticket = (seq: number): OutboxTicket => {
		const settled = new Promise<OutboxResult>((resolve, reject) => {
			const list = waiters.get(seq) ?? [];
			list.push({ resolve, reject });
			waiters.set(seq, list);
		});
		void settled.catch(() => undefined);
		return { seq, settled };
	};
	const resolved = (seq: number): OutboxTicket => ({
		seq,
		settled: Promise.resolve({}),
	});
	const queuedBytes = (except?: number) =>
		entries().reduce(
			(total, entry) =>
				entry.seq === except || entry.failed
					? total
					: total + bytesOf(entry.op),
			0,
		);
	const overCap = (entry: OutboxEntry) => {
		const bytes = bytesOf(entry.op);
		return (
			bytes > 0 && queuedBytes(entry.seq) + bytes > OUTBOX_MAX_QUEUED_BYTES
		);
	};

	const ready = queue.load().then(
		(loaded) => {
			if (disposed || loaded.length === 0) return;
			for (const entry of loaded) lastSeq = Math.max(lastSeq, entry.seq);
			setEntries((current) =>
				[
					...loaded.filter(
						(entry) => !current.some((item) => item.seq === entry.seq),
					),
					...current,
				].sort((left, right) => left.seq - right.seq),
			);
			changed();
		},
		() => undefined,
	);

	const nextSeq = () => {
		lastSeq = Math.max(lastSeq + 1, now());
		return lastSeq;
	};

	const schedule = (delay: number) => {
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			void flush();
		}, delay);
	};

	const fail = (entry: OutboxEntry, error: ColibriError) => {
		log.warn("a queued write failed", {
			code: error.code,
			method: `outbox.${entry.op.t}`,
		});
		if (entry.op.t === "send") replace({ ...entry, failed: true, attempts: 0 });
		else remove(entry.seq);
		changed();
		emit({ type: "failed", entry, code: error.code });
		settle(entry.seq, error);
	};

	const succeed = (entry: OutboxEntry, message?: MessageView) => {
		const current = find(entry.seq) ?? entry;
		remove(entry.seq);
		emit(
			message
				? { type: "sent", entry: current, message }
				: { type: "sent", entry: current },
		);
		settle(entry.seq, message ? { message } : {});
	};

	const storeAttachment = (
		seq: number,
		index: number,
		attachment: AttachmentView,
	) => {
		const current = find(seq);
		if (current?.op.t !== "send") return;
		const files = current.op.files.slice();
		const file = files[index];
		if (!file) return;
		files[index] = { ...file, attachment, uploadedAt: now() };
		replace({ ...current, op: { ...current.op, files } }, false);
	};

	const freshAttachment = (file: QueuedFile) =>
		file.attachment &&
		file.uploadedAt !== undefined &&
		now() - file.uploadedAt <= OUTBOX_BLOB_REF_TTL_MS
			? file.attachment
			: undefined;

	const uploadFiles = async (entry: OutboxEntry, op: SendOp) => {
		const results = op.files.map(freshAttachment);
		const todo = results.flatMap((attachment, index) =>
			attachment ? [] : [index],
		);
		let failure: unknown;
		let next = 0;
		const worker = async () => {
			while (next < todo.length) {
				const index = todo[next++] as number;
				const file = op.files[index] as QueuedFile;
				emit({ type: "progress", entry, file: index, fraction: 0 });
				try {
					const uploaded = await source.uploadBlob(file.file, {
						onProgress: (fraction) =>
							emit({ type: "progress", entry, file: index, fraction }),
					});
					const attachment = withAttachment(file, uploaded);
					results[index] = attachment;
					storeAttachment(entry.seq, index, attachment);
					emit({ type: "progress", entry, file: index, fraction: 1 });
				} catch (thrown) {
					failure ??= thrown;
					emit({
						type: "progress",
						entry,
						file: index,
						fraction: 0,
						failed: true,
					});
				}
			}
		};
		await Promise.all(
			Array.from({ length: Math.min(UPLOAD_CONCURRENCY, todo.length) }, worker),
		);
		if (failure !== undefined) throw failure;
		return results as AttachmentView[];
	};

	const perform = async (
		entry: OutboxEntry,
	): Promise<MessageView | undefined> => {
		const op = entry.op;
		switch (op.t) {
			case "send": {
				const uploaded = await uploadFiles(entry, op);
				return source.sendMessage({
					channel: op.channel,
					rkey: op.rkey,
					text: op.text,
					...(op.facets ? { facets: op.facets } : {}),
					...(op.parent ? { parent: op.parent } : {}),
					...(op.parentAuthor ? { parentAuthor: op.parentAuthor } : {}),
					attachments: [...(op.attachments ?? []), ...uploaded],
					...(op.suppressedEmbeds?.length
						? { suppressedEmbeds: op.suppressedEmbeds }
						: {}),
				});
			}
			case "edit":
				return source.editMessage({
					channel: op.channel,
					rkey: op.rkey,
					text: op.text,
					...(op.facets ? { facets: op.facets } : {}),
				});
			case "delete":
				await source.deleteMessage({ channel: op.channel, rkey: op.rkey });
				return undefined;
			case "react":
				await source.react({
					channel: op.channel,
					rkey: op.rkey,
					emoji: op.emoji,
					...(op.customEmoji ? { customEmoji: op.customEmoji } : {}),
					add: op.add,
					author: op.author,
					...(op.reaction ? { reaction: op.reaction } : {}),
				});
				return undefined;
			case "forward":
				return source.forwardMessage({
					from: op.from,
					rkey: op.rkey,
					to: op.to,
					...(op.text !== undefined ? { text: op.text } : {}),
					forwardRkey: op.forwardRkey,
					...(op.message ? { message: op.message } : {}),
				});
			case "deleteThread":
				await source.deleteThread({ thread: op.thread });
				return undefined;
		}
	};

	const withFreshKey = async (entry: OutboxEntry): Promise<OutboxEntry> => {
		const op = entry.op;
		if (op.t !== "send" || !staleKey(op.rkey, now())) return entry;
		const from = op.rkey;
		const to = nextTid();
		const before = entries();
		const after = before.map((item) => {
			const moved = withMovedKey(item.op, op.channel, from, to);
			return moved === item.op ? item : { ...item, op: moved };
		});
		setEntries(after);
		const current = find(entry.seq) ?? {
			...entry,
			op: { ...op, rkey: to },
		};
		log.info("gave a message queued more than 23 hours ago a fresh key");
		emit({ type: "rekeyed", entry: current, from });
		await Promise.all(
			after
				.filter((item, index) => item !== before[index])
				.map((item) => queue.put(item).catch(() => undefined)),
		);
		return current;
	};

	const attempt = async (head: OutboxEntry): Promise<"done" | "wait"> => {
		const entry = await withFreshKey(head);
		if (abandoned.delete(entry.seq)) return "done";
		try {
			const message = await perform(entry);
			if (abandoned.delete(entry.seq))
				emit(
					message
						? { type: "landedAfterDiscard", entry, message }
						: { type: "landedAfterDiscard", entry },
				);
			else if (find(entry.seq)) succeed(entry, message);
			notBefore = 0;
			return "done";
		} catch (thrown) {
			const error = classifyThrown(thrown, { method: `outbox.${entry.op.t}` });
			const current = find(entry.seq);
			if (abandoned.delete(entry.seq)) {
				if (landedAnyway(entry.op, error))
					emit({ type: "landedAfterDiscard", entry });
				return "done";
			}
			if (!current) return "done";
			if (landedAnyway(current.op, error)) {
				succeed(current);
				notBefore = 0;
				return "done";
			}
			if (held() || !online() || isOffline()) return "wait";
			const attempts = current.attempts + 1;
			if (retryability(error) === "retry" && attempts < OUTBOX_MAX_ATTEMPTS) {
				replace({ ...current, attempts });
				const delay = error.retryAfterMs ?? outboxBackoff(attempts, random);
				notBefore = now() + delay;
				schedule(delay);
				return "wait";
			}
			fail(current, error);
			notBefore = 0;
			return "done";
		}
	};

	const flush = async (): Promise<void> => {
		if (disposed) return;
		if (running) {
			again = true;
			return;
		}
		running = true;
		again = false;
		try {
			await ready;
			while (!disposed) {
				if (held() || !online()) break;
				const head = entries().find((entry) => !entry.failed);
				if (!head) break;
				const wait = notBefore - now();
				if (wait > 0) {
					schedule(wait);
					break;
				}
				inFlight = head.seq;
				const outcome = await attempt(head);
				inFlight = undefined;
				if (outcome === "wait") break;
			}
		} finally {
			running = false;
			changed();
			if (again && !disposed) {
				again = false;
				void flush();
			}
		}
	};

	const nudge = () => {
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = undefined;
		notBefore = 0;
		void flush();
	};

	const idle = (seq: number) => seq !== inFlight;

	const coalesce = (op: OutboxOp): OutboxTicket | undefined => {
		const list = entries();
		if (op.t === "edit") {
			const send = list.find(
				(entry) =>
					entry.op.t === "send" &&
					idle(entry.seq) &&
					targets(entry.op, op.channel, op.rkey),
			);
			if (send?.op.t === "send") {
				replace({
					...send,
					op: {
						...send.op,
						text: op.text,
						...(op.facets ? { facets: op.facets } : { facets: undefined }),
					},
				});
				return ticket(send.seq);
			}
			const edit = list.find(
				(entry) =>
					entry.op.t === "edit" &&
					idle(entry.seq) &&
					targets(entry.op, op.channel, op.rkey),
			);
			if (edit) {
				replace({ ...edit, op, attempts: 0 });
				return ticket(edit.seq);
			}
			return undefined;
		}
		if (op.t === "delete") {
			const related = list.filter(
				(entry) =>
					entry.op.t !== "delete" &&
					idle(entry.seq) &&
					targets(entry.op, op.channel, op.rkey),
			);
			const send = related.find((entry) => entry.op.t === "send");
			for (const entry of related) {
				remove(entry.seq);
				emit({ type: "dropped", entry });
				settle(entry.seq, {});
			}
			return send ? resolved(send.seq) : undefined;
		}
		if (op.t === "react") {
			const opposite = list.find(
				(entry) =>
					entry.op.t === "react" &&
					idle(entry.seq) &&
					entry.op.add !== op.add &&
					entry.op.emoji === op.emoji &&
					targets(entry.op, op.channel, op.rkey),
			);
			if (opposite) {
				remove(opposite.seq);
				emit({ type: "dropped", entry: opposite });
				settle(opposite.seq, {});
				return resolved(opposite.seq);
			}
		}
		return undefined;
	};

	const enqueue = (op: OutboxOp): OutboxTicket => {
		const coalesced = coalesce(op);
		if (coalesced) {
			nudge();
			return coalesced;
		}
		const entry: OutboxEntry = {
			seq: nextSeq(),
			op,
			createdAt: now(),
			attempts: 0,
		};
		const tooLarge = overCap(entry);
		if (tooLarge) entry.failed = true;
		setEntries((list) => [...list, entry]);
		save(entry);
		changed();
		const issued = ticket(entry.seq);
		if (tooLarge)
			queueMicrotask(() =>
				fail(
					entry,
					new ColibriError({ code: "FileTooLarge", method: "outbox.send" }),
				),
			);
		else queueMicrotask(nudge);
		return issued;
	};

	const retry = (seq: number) => {
		const entry = find(seq);
		if (!entry?.failed) return;
		const next: OutboxEntry =
			entry.op.t === "send"
				? {
						...entry,
						op: { ...entry.op, files: withoutUploads(entry.op.files) },
						failed: false,
						attempts: 0,
					}
				: { ...entry, failed: false, attempts: 0 };
		if (overCap(next)) {
			fail(
				entry,
				new ColibriError({ code: "FileTooLarge", method: "outbox.send" }),
			);
			return;
		}
		replace(next);
		nudge();
	};

	const discard = (seq: number) => {
		const entry = find(seq);
		if (!entry) return;
		if (inFlight === seq) abandoned.add(seq);
		remove(seq);
		emit({ type: "dropped", entry });
		settle(seq, {});
	};

	const drain = async (deadlineMs: number): Promise<boolean> => {
		const deadline = now() + deadlineMs;
		await Promise.race([
			ready,
			new Promise((resolve) => setTimeout(resolve, deadlineMs)),
		]);
		const settledAll = () => !entries().some((entry) => !entry.failed);
		if (settledAll()) return true;
		nudge();
		return new Promise<boolean>((resolve) => {
			const finish = (value: boolean) => {
				clearTimeout(timer);
				idleChecks.delete(check);
				resolve(value);
			};
			const check = () => {
				if (settledAll()) finish(true);
			};
			const timer = setTimeout(
				() => finish(settledAll()),
				Math.max(0, deadline - now()),
			);
			idleChecks.add(check);
		});
	};

	const onOnline = () => nudge();
	const onVisible = () => {
		if (document.visibilityState === "visible") nudge();
	};
	const watching = (options.watch ?? true) && typeof window !== "undefined";
	if (watching) {
		window.addEventListener("online", onOnline);
		document.addEventListener("visibilitychange", onVisible);
	}
	void ready.then(nudge);

	return {
		ready: () => ready,
		entries,
		pendingCount: () => entries().filter((entry) => !entry.failed).length,
		enqueue,
		retry,
		discard,
		flush: nudge,
		drain,
		subscribe: (listener: (event: OutboxEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispose: () => {
			disposed = true;
			if (retryTimer) clearTimeout(retryTimer);
			if (watching) {
				window.removeEventListener("online", onOnline);
				document.removeEventListener("visibilitychange", onVisible);
			}
			listeners.clear();
			idleChecks.clear();
		},
	};
};

export type Outbox = ReturnType<typeof createOutbox>;
