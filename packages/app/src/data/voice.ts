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
import type { VoiceNoticeKey } from "./error-copy";
import { createSimulatedConnection } from "./mock/voice-connection";
import { profileBannerFill } from "./profile-theme";
import type { ScreenShareQuality } from "./screen-share";
import type { DataStore } from "./store";
import type { Did, SpaceRef } from "./types";
import type {
	ScreenCapture,
	VoiceConnection,
	VoiceConnectionMonitor,
	VoiceModeration,
	VoiceVideo,
} from "./voice/types";
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
	screenSharing: Accessor<boolean>;
	expanded: Accessor<boolean>;
	startedAt: Accessor<number | undefined>;
	connection: Accessor<VoiceConnection>;
	videos: Accessor<readonly VoiceVideo[]>;
	moderationOf: (did: string) => VoiceModeration;
	inCall: (did: string) => boolean;
	channelOf: (did: string) => string | undefined;
	floatingDismissed: Accessor<boolean>;
	setFloatingDismissed(dismissed: boolean): void;
	focusedKey: Accessor<string | null>;
	setFocusedKey(key: string | null): void;
	join(call: VoiceCall, opts?: { muted?: boolean }): void;
	leave(): void;
	toggleMute(): void;
	toggleDeafen(): void;
	toggleCamera(): void;
	shareScreen(
		capture: ScreenCapture,
		quality: ScreenShareQuality,
	): Promise<boolean>;
	stopScreenShare(): void;
	applyScreenQuality(quality: ScreenShareQuality): void;
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

const NO_VIDEOS: readonly VoiceVideo[] = [];

export type VoiceNotifier = (key: VoiceNoticeKey) => void;

export const createVoice = (
	player: VoiceSoundPlayer = createVoiceSoundPlayer(),
	monitor: () => VoiceConnectionMonitor = createSimulatedConnection,
	notifier: VoiceNotifier = () => {},
) =>
	createRoot(() => {
		let playSound = player;
		let notifyWith = notifier;
		const notify = (key: VoiceNoticeKey) => notifyWith(key);
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

		const moderationOf = (did: string): VoiceModeration => {
			const live = current() ? link().moderation?.()[did] : undefined;
			if (live) return live;
			const voice = store()?.presenceOf(did as Did)?.voice;
			return {
				serverMuted: !!voice?.serverMuted,
				serverDeafened: !!voice?.serverDeafened,
			};
		};

		const viewerDid = () => store()?.viewer.did;

		const speakingIn = (channelUri: string, did: Did) => {
			if (current()?.channel !== channelUri) return false;
			const speakers = link().speakers;
			if (speakers) return speakers().has(did);
			return !!store()?.isSpeaking(did);
		};

		const sharingIn = (channelUri: string, did: Did) =>
			current()?.channel === channelUri &&
			!!link()
				.videos?.()
				.some((video) => video.did === did);

		const channelOf = (did: string) =>
			store()?.presenceOf(did as Did)?.voice?.channel;

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

		const session = () => ({
			channel: current()?.channel ?? "",
			muted: muted(),
			deafened: deafened(),
		});

		const syncLink = () => {
			if (!current()) return;
			link().setMuted?.(muted());
			link().setDeafened?.(deafened());
		};

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
					bannerFill: profileBannerFill(actor?.theme),
					presence: uiPresence(data.presenceOf(did)),
					speaking: speakingIn(channelUri, did),
					muted: voice?.muted,
					deafened: voice?.deafened,
					streaming:
						!!(voice?.camera || voice?.screen) ||
						sharingIn(channelUri, did) ||
						undefined,
					...moderated(channelUri, did, voice),
				};
			});
		};

		const moderated = (
			channelUri: string,
			did: Did,
			voice: { serverMuted?: boolean; serverDeafened?: boolean } | undefined,
		) => {
			const live =
				current()?.channel === channelUri
					? link().moderation?.()[did]
					: undefined;
			return {
				serverMuted: live ? live.serverMuted || undefined : voice?.serverMuted,
				serverDeafened: live
					? live.serverDeafened || undefined
					: voice?.serverDeafened,
			};
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

		const ended = () => {
			if (!current()) return;
			reset();
			play("leave");
			publish();
		};

		const moved = (channel: string) => {
			const active = current();
			if (!active || active.channel === channel) return;
			batch(() => {
				setCurrent({ ...active, channel });
				setCamera(false);
				setStartedAt(Date.now());
				setFocusedKey(null);
			});
			link().start(session());
			play("join");
			notify("moved");
			publish();
		};

		let detach: (() => void) | undefined;
		const attach = (active: VoiceConnectionMonitor) => {
			detach?.();
			const releaseEnded = active.onEnded?.((reason) => {
				if (!current()) return;
				notify(reason);
				ended();
			});
			const releaseMoved = active.onMoved?.(moved);
			const releaseNotice = active.onNotice?.(notify);
			const releaseScreenShare = active.onScreenShare?.((sharing) => {
				if (current()) play(sharing ? "screenShared" : "screenUnshared");
			});
			detach = () => {
				releaseEnded?.();
				releaseMoved?.();
				releaseNotice?.();
				releaseScreenShare?.();
			};
		};
		attach(link());

		const screenSharing = () => !!current() && !!link().screenSharing?.();

		const selfModeration = () => {
			const did = viewerDid();
			return did
				? moderationOf(did)
				: { serverMuted: false, serverDeafened: false };
		};

		const controller: VoiceController = {
			current,
			participants,
			muted,
			deafened,
			camera,
			screenSharing,
			expanded,
			startedAt,
			connection: () => link().connection(),
			videos: () => (current() ? (link().videos?.() ?? NO_VIDEOS) : NO_VIDEOS),
			moderationOf,
			inCall: (did) => {
				const call = current();
				return !!call && channelOf(did) === call.channel;
			},
			channelOf,
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
				link().start(session());
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
				if (current() && selfModeration().serverMuted) {
					notify("serverMuted");
					return;
				}
				batch(() => {
					if (deafened()) {
						setDeafened(false);
						setSelfMuted(false);
						return;
					}
					setSelfMuted(!selfMuted());
				});
				play(muted() ? "mute" : "unmute");
				syncLink();
				if (current()) publish();
			},
			toggleDeafen: () => {
				if (current() && selfModeration().serverDeafened) {
					notify("serverDeafened");
					return;
				}
				setDeafened(!deafened());
				play(deafened() ? "deafen" : "undeafen");
				syncLink();
				if (current()) publish();
			},
			toggleCamera: () => {
				const call = current();
				if (!call) return;
				const next = !camera();
				setCamera(next);
				play(next ? "camOn" : "camOff");
				const apply = link().setCamera;
				if (!apply) return;
				void apply(next).then((on) => {
					if (current() === call && camera() === next && on !== next) {
						setCamera(on);
					}
				});
			},
			shareScreen: async (capture, quality) => {
				const share = link().shareScreen;
				if (!current() || !share) {
					capture.video.stop();
					capture.audio?.stop();
					capture.release();
					return false;
				}
				return share(capture, quality);
			},
			stopScreenShare: () => link().stopScreen?.(),
			applyScreenQuality: (quality) => link().applyScreenQuality?.(quality),
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
			attach(next);
			if (restart) next.start(session());
		};

		const setNotifier = (next: VoiceNotifier) => {
			notifyWith = next;
		};

		return { controller, connect, setPlayer, setMonitor, setNotifier };
	});

const instance = createVoice();

export const voice = instance.controller;

export const connectVoice = instance.connect;

export const setVoiceSoundPlayer = instance.setPlayer;

export const setVoiceConnectionMonitor = instance.setMonitor;

export const setVoiceNotifier = instance.setNotifier;
