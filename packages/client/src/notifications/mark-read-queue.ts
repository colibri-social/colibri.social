export type PendingMarkRead = {
	channelUri: string;
	messageUri?: string;
	actionedAt: number;
};

type NotificationActionsBridge = {
	pendingMarkRead: () => string;
	ackMarkRead: (channelUri: string) => void;
};

export const PENDING_MARK_READ_EVENT = "colibri-mark-read-pending";

const bridge = (): NotificationActionsBridge | undefined => {
	if (typeof window === "undefined") return undefined;
	return (
		window as unknown as {
			__colibriNotificationActions?: NotificationActionsBridge;
		}
	).__colibriNotificationActions;
};

const isEntry = (value: unknown): value is PendingMarkRead => {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.channelUri === "string" &&
		entry.channelUri.length > 0 &&
		typeof entry.actionedAt === "number" &&
		(entry.messageUri === undefined || typeof entry.messageUri === "string")
	);
};

export const readPendingMarkRead = (): PendingMarkRead[] => {
	const actions = bridge();
	if (!actions) return [];

	try {
		const parsed: unknown = JSON.parse(actions.pendingMarkRead());
		return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
	} catch {
		return [];
	}
};

export const ackMarkRead = (channelUri: string): void => {
	try {
		bridge()?.ackMarkRead(channelUri);
	} catch {}
};

export const listenForPendingMarkRead = (handler: () => void): (() => void) => {
	if (typeof window === "undefined") return () => {};

	window.addEventListener(PENDING_MARK_READ_EVENT, handler);
	return () => window.removeEventListener(PENDING_MARK_READ_EVENT, handler);
};
