import type { OsActivation, OsNotification } from "./types";

const PREFIX = "colibri-notification:";

export const encodeActivation = (notification: OsNotification): string => {
	const params = new URLSearchParams({ channel: notification.channel });
	if (notification.thread) params.set("thread", notification.thread);
	if (notification.rkey) params.set("rkey", notification.rkey);
	return `${PREFIX}${params.toString()}`;
};

export const decodeActivation = (
	key: string | undefined,
	fallbackChannel?: string,
): OsActivation | undefined => {
	if (key?.startsWith(PREFIX)) {
		const params = new URLSearchParams(key.slice(PREFIX.length));
		const channel = params.get("channel");
		if (channel) {
			const activation: OsActivation = { channel };
			const thread = params.get("thread");
			const rkey = params.get("rkey");
			if (thread) activation.thread = thread;
			if (rkey) activation.rkey = rkey;
			return activation;
		}
	}
	return fallbackChannel?.startsWith("at://")
		? { channel: fallbackChannel }
		: undefined;
};

export const createActivationBus = () => {
	const handlers = new Set<(activation: OsActivation) => void>();
	let pending: OsActivation | undefined;
	return {
		emit: (activation: OsActivation) => {
			if (handlers.size === 0) {
				pending = activation;
				return;
			}
			for (const handler of [...handlers]) handler(activation);
		},
		subscribe: (handler: (activation: OsActivation) => void) => {
			handlers.add(handler);
			const buffered = pending;
			pending = undefined;
			if (buffered) handler(buffered);
			return () => {
				handlers.delete(handler);
			};
		},
		discard: () => {
			pending = undefined;
		},
	};
};

export type ActivationBus = ReturnType<typeof createActivationBus>;
