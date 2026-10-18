import { classifyThrown, createLogger } from "@colibri-social/lib";
import { messageRecord } from "./activation";

export const PENDING_MARK_READ_EVENT = "colibri-mark-read-pending";

export type PendingMarkRead = {
	channelUri: string;
	threadUri?: string;
	messageUri?: string;
	actionedAt: number;
};

export type MarkReadBridge = {
	pendingMarkRead: () => string;
	ackMarkRead: (channelUri: string) => void;
};

export type MarkReadTarget = { space: string; rkey?: string };

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;

const log = createLogger("push");

export const markReadBridge = (): MarkReadBridge | undefined =>
	typeof window === "undefined"
		? undefined
		: (window as { __colibriNotificationActions?: MarkReadBridge })
				.__colibriNotificationActions;

const isEntry = (value: unknown): value is PendingMarkRead => {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.channelUri === "string" &&
		entry.channelUri.length > 0 &&
		typeof entry.actionedAt === "number" &&
		(entry.messageUri === undefined ||
			entry.messageUri === null ||
			typeof entry.messageUri === "string") &&
		(entry.threadUri === undefined ||
			entry.threadUri === null ||
			typeof entry.threadUri === "string")
	);
};

export const readPendingMarkRead = (
	bridge: MarkReadBridge | undefined,
): PendingMarkRead[] => {
	if (!bridge) return [];
	try {
		const parsed: unknown = JSON.parse(bridge.pendingMarkRead());
		return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
	} catch {
		return [];
	}
};

export const markReadTarget = (entry: PendingMarkRead): MarkReadTarget => {
	const record = messageRecord(entry.messageUri ?? undefined);
	const space = entry.threadUri || record?.space || entry.channelUri;
	return record && record.space === space
		? { space, rkey: record.rkey }
		: { space };
};

export const createMarkReadDrain = (options: {
	bridge: () => MarkReadBridge | undefined;
	markRead: (target: MarkReadTarget) => Promise<void>;
}) => {
	let draining = false;
	let again = false;

	const drainOnce = async () => {
		const bridge = options.bridge();
		for (const entry of readPendingMarkRead(bridge)) {
			try {
				await options.markRead(markReadTarget(entry));
				bridge?.ackMarkRead(entry.threadUri || entry.channelUri);
			} catch (thrown) {
				log.warn("marking a channel read from a notification failed", {
					code: classifyThrown(thrown, { method: "push.markRead" }).code,
				});
			}
		}
	};

	return async () => {
		if (draining) {
			again = true;
			return;
		}
		draining = true;
		try {
			do {
				again = false;
				await drainOnce();
			} while (again);
		} finally {
			draining = false;
		}
	};
};

export const installMarkReadDrain = (
	markRead: (target: MarkReadTarget) => Promise<void>,
	options: {
		bridge?: () => MarkReadBridge | undefined;
		target?: Listenable;
	} = {},
): (() => void) => {
	const target =
		options.target ?? (typeof window === "undefined" ? undefined : window);
	const drain = createMarkReadDrain({
		bridge: options.bridge ?? markReadBridge,
		markRead,
	});
	const onPending = () => void drain();
	void drain();
	target?.addEventListener(PENDING_MARK_READ_EVENT, onPending);
	return () => target?.removeEventListener(PENDING_MARK_READ_EVENT, onPending);
};
