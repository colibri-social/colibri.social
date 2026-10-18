import { createEffect, createRoot, on, onCleanup } from "solid-js";
import { skeyOf } from "../data/ids";
import type { DataStore } from "../data/store";
import { voice as defaultVoice, type VoiceController } from "../data/voice";

export type NativeCallInfo = {
	title: string;
	subtitle: string;
	muted: boolean;
	deafened: boolean;
	startedAt: number;
};

export type NativeCallAction = "mute" | "leave" | "open";

export type NativeCallPort = {
	start: (info: NativeCallInfo) => void;
	update: (info: NativeCallInfo) => void;
	stop: () => void;
	onAction: (listener: (action: NativeCallAction) => void) => () => void;
};

type AndroidCallBridge = {
	start: (json: string) => void;
	update: (json: string) => void;
	stop: () => void;
};

const ACTION_EVENT = "colibri-call-action";

const isAction = (value: unknown): value is NativeCallAction =>
	value === "mute" || value === "leave" || value === "open";

export const androidCallPort = (): NativeCallPort | undefined => {
	if (typeof window === "undefined") return undefined;
	const bridge = (window as unknown as { __colibriCall?: AndroidCallBridge })
		.__colibriCall;
	if (!bridge) return undefined;
	return {
		start: (info) => bridge.start(JSON.stringify(info)),
		update: (info) => bridge.update(JSON.stringify(info)),
		stop: () => bridge.stop(),
		onAction: (listener) => {
			const handle = (event: Event) => {
				const detail = (event as CustomEvent<unknown>).detail;
				if (isAction(detail)) listener(detail);
			};
			window.addEventListener(ACTION_EVENT, handle);
			return () => window.removeEventListener(ACTION_EVENT, handle);
		},
	};
};

type CallStore = Pick<DataStore, "spaceByKey" | "space">;

const FALLBACK_TITLE = "Voice call";

export const installNativeCall = (
	data: CallStore,
	port: NativeCallPort | undefined = androidCallPort(),
	voice: VoiceController = defaultVoice,
) => {
	if (!port) return () => {};
	return createRoot((dispose) => {
		const describe = (): NativeCallInfo | undefined => {
			const call = voice.current();
			if (!call) return undefined;
			const community = data.spaceByKey(call.space);
			const channel = community
				? data.space(community).channelBySlug(skeyOf(call.channel))
				: undefined;
			return {
				title: channel?.name ?? FALLBACK_TITLE,
				subtitle: community?.name ?? "",
				muted: voice.muted(),
				deafened: voice.deafened(),
				startedAt: voice.startedAt() ?? Date.now(),
			};
		};

		let running = false;

		createEffect(
			on(describe, (info) => {
				if (!info) {
					if (running) port.stop();
					running = false;
					return;
				}
				if (running) port.update(info);
				else port.start(info);
				running = true;
			}),
		);

		const release = port.onAction((action) => {
			if (action === "mute") voice.toggleMute();
			else if (action === "leave") voice.leave();
			else voice.expand();
		});

		onCleanup(() => {
			release();
			if (running) port.stop();
		});

		return dispose;
	});
};
