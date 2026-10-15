import type { VoiceParticipant } from "@colibri-social/ui";
import {
	type Accessor,
	batch,
	createEffect,
	createRoot,
	createSignal,
	on,
} from "solid-js";
import { displayNameOf } from "./adapters/display-name";
import { uiPresence } from "./adapters/presence";
import {
	createSimulatedConnection,
	type VoiceConnection,
	type VoiceConnectionMonitor,
} from "./mock/voice-connection";
import type { DataStore } from "./store";
import type { Did, SpaceRef } from "./types";
import {
	createVoiceSoundPlayer,
	type VoiceSound,
	type VoiceSoundPlayer,
} from "./voice-sounds";

export type VoiceCall = { space: string; channel: string };

export type VoiceController = {
	current: Accessor<VoiceCall | undefined>;
	participants: (channelUri: string) => VoiceParticipant[];
	muted: Accessor<boolean>;
	deafened: Accessor<boolean>;
	camera: Accessor<boolean>;
	expanded: Accessor<boolean>;
	startedAt: Accessor<number | undefined>;
	connection: Accessor<VoiceConnection>;
	floatingDismissed: Accessor<boolean>;
	setFloatingDismissed(dismissed: boolean): void;
	focusedKey: Accessor<string | null>;
	setFocusedKey(key: string | null): void;
	join(call: VoiceCall, opts?: { muted?: boolean }): void;
	leave(): void;
	toggleMute(): void;
	toggleDeafen(): void;
	toggleCamera(): void;
	expand(): void;
	collapse(): void;
	cue(sound: VoiceSound): void;
};

type VoiceStore = Pick<
	DataStore,
	| "communities"
	| "space"
	| "viewer"
	| "presenceOf"
	| "inVoice"
	| "isSpeaking"
	| "setVoice"
>;

const communityOf = (channelUri: string) => channelUri.split("/")[2] ?? "";

export const createVoice = (
	player: VoiceSoundPlayer = createVoiceSoundPlayer(),
	monitor: () => VoiceConnectionMonitor = createSimulatedConnection,
) =>
	createRoot(() => {
		let playSound = player;
		const [link, setLink] = createSignal<VoiceConnectionMonitor>(monitor());
		const [floatingDismissed, setFloatingDismissed] = createSignal(false);
		const [focusedKey, setFocusedKey] = createSignal<string | null>(null);
		const play = (sound: VoiceSound) => playSound(sound);
		const [store, setStore] = createSignal<VoiceStore>();
		const [current, setCurrent] = createSignal<VoiceCall>();
		const [selfMuted, setSelfMuted] = createSignal(false);
		const [deafened, setDeafened] = createSignal(false);
		const [camera, setCamera] = createSignal(false);
		const [expanded, setExpanded] = createSignal(false);
		const [startedAt, setStartedAt] = createSignal<number>();

		const muted = () => selfMuted() || deafened();

		const publish = () => {
			const data = store();
			if (!data) return;
			const call = current();
			void data
				.setVoice(
					call
						? {
								channel: call.channel as SpaceRef,
								muted: muted() || undefined,
								deafened: deafened() || undefined,
							}
						: undefined,
				)
				.catch(() => {});
		};

		const reset = () =>
			batch(() => {
				setCurrent(undefined);
				setSelfMuted(false);
				setDeafened(false);
				setCamera(false);
				setExpanded(false);
				setStartedAt(undefined);
				setFloatingDismissed(false);
				setFocusedKey(null);
				link().stop();
			});

		const participants = (channelUri: string): VoiceParticipant[] => {
			const data = store();
			if (!data) return [];
			const community = data.communities
				.value()
				?.find((entry) => entry.did === communityOf(channelUri));
			const space = community ? data.space(community) : undefined;
			space?.members.value();
			return data.inVoice(channelUri).map((did: Did) => {
				const member = space?.memberByDid(did);
				const voice = data.presenceOf(did)?.voice;
				const self = did === data.viewer.did;
				const actor = member?.actor ?? (self ? data.viewer : undefined);
				return {
					id: did,
					pending: !actor || undefined,
					name: actor
						? displayNameOf(actor, member)
						: member?.nickname?.trim() || did,
					avatarSrc: actor?.avatar,
					presence: uiPresence(data.presenceOf(did)),
					speaking: current()?.channel === channelUri && data.isSpeaking(did),
					muted: voice?.muted,
					deafened: voice?.deafened,
					serverMuted: voice?.serverMuted,
					serverDeafened: voice?.serverDeafened,
				};
			});
		};

		const others = (channelUri: string) => {
			const data = store();
			if (!data) return [];
			return data
				.inVoice(channelUri)
				.filter((did: Did) => did !== data.viewer.did);
		};

		createEffect(
			on(
				() => current()?.channel,
				(channel) => {
					if (!channel) return;
					let previous = new Set(others(channel));
					createEffect(
						on(
							() => others(channel),
							(next) => {
								const nextSet = new Set(next);
								const joined = next.some((did) => !previous.has(did));
								const left = [...previous].some((did) => !nextSet.has(did));
								previous = nextSet;
								if (joined) play("join");
								else if (left) play("leave");
							},
							{ defer: true },
						),
					);
				},
			),
		);

		const controller: VoiceController = {
			current,
			participants,
			muted,
			deafened,
			camera,
			expanded,
			startedAt,
			connection: () => link().connection(),
			floatingDismissed,
			setFloatingDismissed,
			focusedKey,
			setFocusedKey,
			join: (call, opts) => {
				const active = current();
				if (active?.channel === call.channel) {
					setExpanded(true);
					return;
				}
				if (active) play("leave");
				batch(() => {
					setCurrent({ ...call });
					if (opts?.muted !== undefined) setSelfMuted(opts.muted);
					setCamera(false);
					setStartedAt(Date.now());
					setExpanded(true);
					setFloatingDismissed(false);
					setFocusedKey(null);
				});
				link().start();
				play("join");
				publish();
			},
			leave: () => {
				if (!current()) return;
				reset();
				play("leave");
				publish();
			},
			toggleMute: () => {
				batch(() => {
					if (deafened()) {
						setDeafened(false);
						setSelfMuted(false);
						return;
					}
					setSelfMuted(!selfMuted());
				});
				play(muted() ? "mute" : "unmute");
				if (current()) publish();
			},
			toggleDeafen: () => {
				setDeafened(!deafened());
				play(deafened() ? "deafen" : "undeafen");
				if (current()) publish();
			},
			toggleCamera: () => {
				if (!current()) return;
				setCamera(!camera());
				play(camera() ? "camOn" : "camOff");
			},
			expand: () => {
				if (current()) setExpanded(true);
			},
			collapse: () => setExpanded(false),
			cue: play,
		};

		const connect = (data: VoiceStore) =>
			batch(() => {
				reset();
				setStore(() => data);
			});

		const setPlayer = (next: VoiceSoundPlayer) => {
			playSound = next;
		};

		const setMonitor = (next: VoiceConnectionMonitor) => {
			const restart = !!current();
			link().stop();
			setLink(() => next);
			if (restart) next.start();
		};

		return { controller, connect, setPlayer, setMonitor };
	});

const instance = createVoice();

export const voice = instance.controller;

export const connectVoice = instance.connect;

export const setVoiceSoundPlayer = instance.setPlayer;

export const setVoiceConnectionMonitor = instance.setMonitor;
