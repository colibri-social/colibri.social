import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type ActivationBus,
	decodeActivation,
	encodeActivation,
	isActivationKey,
} from "./activation";
import type { TauriPort } from "./tauri-port";
import { type OsNotifier, targetOf } from "./types";

const ACTIVATION_EVENT = "colibri-notification-activated";

const AVATAR_WAIT_MS = 250;
const AVATAR_RETRY_MS = 10 * 60_000;

type NativeActivation = { channelUri: string; messageUri?: string | null };

type NativeNotifierTiming = {
	now?: () => number;
	avatarWaitMs?: number;
	avatarRetryMs?: number;
};

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
	timing: NativeNotifierTiming = {},
): OsNotifier => {
	const now = timing.now ?? Date.now;
	const avatarWaitMs = timing.avatarWaitMs ?? AVATAR_WAIT_MS;
	const avatarRetryMs = timing.avatarRetryMs ?? AVATAR_RETRY_MS;
	const avatars = new Map<string, Promise<string | undefined>>();
	const failedAvatars = new Map<string, number>();
	let listening = false;
	let lastKey: string | undefined;

	const activate = (activation: NativeActivation | null | undefined) => {
		if (!activation || !isActivationKey(activation.messageUri)) return;
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

		const failedAt = failedAvatars.get(did);

		if (failedAt !== undefined && now() - failedAt < avatarRetryMs) {
			return Promise.resolve(undefined);
		}

		failedAvatars.delete(did);

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
					failedAvatars.set(did, now());
					warn("native_notify_cache_avatar")(thrown);
					return undefined;
				},
			);
		avatars.set(did, pending);

		return pending;
	};

	const avatarWithin = (did: string, url: string | undefined) => {
		const pending = avatarPath(did, url);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<undefined>((resolve) => {
			timer = setTimeout(() => resolve(undefined), avatarWaitMs);
		});

		return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
	};

	return {
		kind: "native",
		permission: async () => "granted",
		requestPermission: async () => "granted",
		show: async (notification) => {
			listen();
			const iconPath = await avatarWithin(
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
