import { type ActivationBus, encodeActivation } from "./activation";
import {
	joinedBody,
	type OsNotifier,
	type OsPermission,
	targetOf,
} from "./types";

const FALLBACK_ICON = "/web-app-manifest-192x192.png";

const browserPermission = (): OsPermission => {
	if (typeof Notification === "undefined") return "unsupported";
	return Notification.permission;
};

export const createWebNotifier = (bus: ActivationBus): OsNotifier => {
	const open = new Map<string, Set<Notification>>();

	const forget = (target: string, notification: Notification) => {
		const set = open.get(target);
		set?.delete(notification);
		if (set?.size === 0) open.delete(target);
	};

	return {
		kind: "web",
		permission: async () => browserPermission(),
		requestPermission: async () => {
			if (typeof Notification === "undefined") return "unsupported";
			try {
				return await Notification.requestPermission();
			} catch {
				return "denied";
			}
		},
		show: async (payload) => {
			if (browserPermission() !== "granted") return;
			const target = targetOf(payload);
			const notification = new Notification(payload.title, {
				body: joinedBody(payload),
				tag: encodeActivation(payload),
				icon: payload.avatar ?? FALLBACK_ICON,
				silent: true,
			});
			const set = open.get(target) ?? new Set();
			set.add(notification);
			open.set(target, set);
			notification.onclick = () => {
				window.focus();
				bus.emit({
					channel: payload.channel,
					...(payload.thread ? { thread: payload.thread } : {}),
					...(payload.rkey ? { rkey: payload.rkey } : {}),
				});
				notification.close();
			};
			notification.onclose = () => forget(target, notification);
		},
		dismiss: async (target) => {
			const set = open.get(target);
			if (!set) return;
			open.delete(target);
			for (const notification of set) notification.close();
		},
		clearAll: async () => {
			bus.discard();
			const all = [...open.values()];
			open.clear();
			for (const set of all) {
				for (const notification of set) notification.close();
			}
		},
		onActivation: bus.subscribe,
	};
};
