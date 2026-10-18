import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type Accessor,
	createEffect,
	createRoot,
	createSignal,
	on,
} from "solid-js";
import { currentReleasePlatform } from "../../data/release-notes";
import { type TauriPort, tauriPort } from "../notifications/tauri-port";
import { pushActivations } from "./activation";
import { createApnsProvider, listenForApnsActivations } from "./apns";
import { createFcmProvider } from "./fcm";
import type { PushApi, PushPort, PushProvider } from "./types";
import {
	createWebPushProvider,
	listenForWorkerActivations,
	webPushEnvironment,
} from "./web";

export {
	openNotificationLink,
	openPushActivation,
	parseNotificationLink,
	parsePushActivation,
	pushActivations,
} from "./activation";
export { installMarkReadDrain } from "./mark-read";
export { createReadSweep, readTargets } from "./read-sweep";
export type { PushApi, PushProvider } from "./types";

export const PUSH_REASSERT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const log = createLogger("push");

export type PushDevice = {
	active: () => boolean;
	refresh?: () => Promise<unknown>;
};

export type Push = {
	kind: PushProvider["kind"] | undefined;
	active: Accessor<boolean>;
	enable: () => Promise<boolean>;
	reassert: () => Promise<void>;
	disable: () => Promise<void>;
	watch: () => () => void;
	setLive: (live: boolean) => void;
	dismiss: (target: string | undefined) => Promise<void>;
	dismissRead: (channels: string[]) => Promise<void>;
};

export const pushPort = (): PushPort => ({
	...tauriPort(),
	pluginListener: async (plugin, event, handler) => {
		const { addPluginListener } = await import("@tauri-apps/api/core");
		const listener = await addPluginListener(plugin, event, handler);
		return () => {
			void listener.unregister();
		};
	},
});

export const resolvePushProvider = (
	port: PushPort = pushPort(),
): PushProvider | undefined => {
	const platform = currentReleasePlatform();
	if (platform === "ios" || platform === "macos") {
		return createApnsProvider({ port, platform });
	}
	if (platform === "android") return createFcmProvider({ port });
	if (platform !== "web") return undefined;
	const environment = webPushEnvironment();
	return environment ? createWebPushProvider({ environment }) : undefined;
};

export const listenForPushActivations = (
	port: TauriPort = tauriPort(),
): (() => void) => {
	const platform = currentReleasePlatform();
	if (platform === "ios" || platform === "macos") {
		return listenForApnsActivations(port, pushActivations.emit);
	}
	const environment = platform === "web" ? webPushEnvironment() : undefined;
	return environment
		? listenForWorkerActivations(environment.workers, pushActivations.emit)
		: () => {};
};

const failed = (message: string, method: string) => (thrown: unknown) => {
	log.warn(message, { code: classifyThrown(thrown, { method }).code });
};

export const createPush = (options: {
	source: PushApi;
	device: PushDevice;
	provider?: PushProvider | null;
	port?: TauriPort;
	reassertMs?: number;
}): Push => {
	const provider =
		options.provider === null
			? undefined
			: (options.provider ?? resolvePushProvider());
	const port = options.port ?? tauriPort();
	const native = provider?.kind === "apns" || provider?.kind === "fcm";
	const [active, setActive] = createSignal(false);
	let pending: Promise<boolean> | undefined;
	let lastLive: boolean | undefined;

	const enable = (): Promise<boolean> => {
		if (!provider) return Promise.resolve(false);
		pending ??= provider
			.subscribe(options.source)
			.then(
				(subscribed) => {
					setActive(subscribed);
					return subscribed;
				},
				(thrown: unknown) => {
					failed(
						"registering for push failed, using live notifications",
						"push.register",
					)(thrown);
					setActive(false);
					return false;
				},
			)
			.finally(() => {
				pending = undefined;
			});
		return pending;
	};

	const disable = async () => {
		setActive(false);
		if (!provider) return;
		await provider
			.unsubscribe(options.source)
			.catch(failed("unregistering from push failed", "push.unregister"));
	};

	const reassert = async () => {
		if (!provider) return;
		await options.device.refresh?.().catch(() => undefined);
		if (options.device.active()) {
			await enable();
			return;
		}
		const leftover = await provider.hasLeftover().catch(() => false);
		if (active() || leftover) await disable();
	};

	const watch = () => {
		if (!provider) return () => {};
		const onVisible = () => {
			if (document.visibilityState === "visible") void reassert();
		};
		document.addEventListener("visibilitychange", onVisible);
		const interval = setInterval(
			() => void reassert(),
			options.reassertMs ?? PUSH_REASSERT_INTERVAL_MS,
		);
		const stopProvider = provider.watch(() => void reassert());
		const stopDevice = createRoot((dispose) => {
			createEffect(
				on(
					() => options.device.active(),
					(now, previous) => {
						if (now) void enable();
						else if (previous) void disable();
					},
					{ defer: true },
				),
			);
			return dispose;
		});
		void reassert();
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			clearInterval(interval);
			stopProvider();
			stopDevice();
		};
	};

	return {
		kind: provider?.kind,
		active,
		enable,
		reassert,
		disable,
		watch,
		setLive: (live) => {
			if (!native || live === lastLive) return;
			lastLive = live;
			void port.invoke("push_set_live", { live }).catch(() => undefined);
		},
		dismiss: async (target) => {
			await provider?.dismiss(target).catch(() => undefined);
		},
		dismissRead: async (channels) => {
			if (!native || channels.length === 0) return;
			await port
				.invoke("push_dismiss_read", { channels })
				.catch(
					failed("clearing read notifications failed", "push_dismiss_read"),
				);
		},
	};
};

export const teardownLeftoverPush = async (
	provider: PushProvider | undefined = resolvePushProvider(),
): Promise<void> => {
	pushActivations.discard();
	if (!provider) return;
	try {
		if (await provider.hasLeftover()) await provider.unsubscribe();
	} catch (thrown) {
		failed(
			"removing a leftover push registration failed",
			"push.teardown",
		)(thrown);
	}
};

const [current, setCurrent] = createSignal<Push>();

export const currentPush: Accessor<Push | undefined> = current;

export const bindPush = (push: Push): (() => void) => {
	setCurrent(() => push);
	return () => {
		if (current() === push) setCurrent(undefined);
	};
};
