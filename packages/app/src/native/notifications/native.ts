import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type ActivationBus,
	decodeActivation,
	encodeActivation,
} from "./activation";
import type { TauriPort } from "./tauri-port";
import { type OsNotifier, targetOf } from "./types";

const ACTIVATION_EVENT = "colibri-notification-activated";

type NativeActivation = { channelUri: string; messageUri?: string | null };

const log = createLogger("notifications");

const warn = (method: string) => (thrown: unknown) => {
	log.warn("a native notification call failed", {
		code: classifyThrown(thrown, { method }).code,
	});
};

export const createNativeNotifier = (
	port: TauriPort,
	bus: ActivationBus,
	fetchBytes: (url: string) => Promise<ArrayBuffer> = (url) =>
		fetch(url).then((response) => {
			if (!response.ok) throw new Error(`avatar ${response.status}`);
			return response.arrayBuffer();
		}),
): OsNotifier => {
	const avatars = new Map<string, Promise<string | undefined>>();
	let listening = false;
	let lastKey: string | undefined;

	const activate = (activation: NativeActivation | null | undefined) => {
		if (!activation) return;
		const key = `${activation.channelUri} ${activation.messageUri ?? ""}`;
		if (key === lastKey) return;
		lastKey = key;
		const decoded = decodeActivation(
			activation.messageUri ?? undefined,
			activation.channelUri,
		);
		if (decoded) bus.emit(decoded);
	};

	const listen = () => {
		if (listening) return;
		listening = true;
		void port
			.listen<NativeActivation>(ACTIVATION_EVENT, ({ payload }) =>
				activate(payload),
			)
			.catch(warn("native_notify.listen"));
		void port
			.invoke<NativeActivation | null>("native_notify_take_activation")
			.then(activate, warn("native_notify_take_activation"));
	};

	const avatarPath = (did: string, url: string | undefined) => {
		if (!url) return Promise.resolve(undefined);
		const cached = avatars.get(did);
		if (cached) return cached;
		const pending = fetchBytes(url)
			.then((data) =>
				port.invoke<string | null>("native_notify_cache_avatar", {
					cid: did,
					bytes: Array.from(new Uint8Array(data)),
				}),
			)
			.then(
				(path) => path ?? undefined,
				(thrown: unknown) => {
					avatars.delete(did);
					warn("native_notify_cache_avatar")(thrown);
					return undefined;
				},
			);
		avatars.set(did, pending);
		return pending;
	};

	return {
		kind: "native",
		permission: async () => "granted",
		requestPermission: async () => "granted",
		show: async (notification) => {
			listen();
			const iconPath = await avatarPath(
				notification.authorDid,
				notification.avatar,
			);
			await port
				.invoke("native_notify", {
					payload: {
						title: notification.title,
						body: notification.body,
						subtitle: notification.subtitle ?? null,
						channelUri: targetOf(notification),
						messageUri: encodeActivation(notification),
						iconPath: iconPath ?? null,
					},
				})
				.catch(warn("native_notify"));
		},
		dismiss: async (target) => {
			await port
				.invoke("native_notify_dismiss", { channelUri: target })
				.catch(() => undefined);
		},
		clearAll: async () => {
			bus.discard();
			await port.invoke("native_notify_clear_all").catch(() => undefined);
		},
		onActivation: (handler) => {
			listen();
			return bus.subscribe(handler);
		},
	};
};
