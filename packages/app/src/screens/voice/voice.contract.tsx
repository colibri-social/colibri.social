import {
	type CallControlSize,
	CallControls,
	ChannelHeader,
	VoiceJoinActions,
	VoiceJoinRoster,
	VoiceSheetHeader,
	VoiceStage,
	type VoiceTileData,
} from "@colibri-social/ui";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { batch, createMemo, createSignal, Show } from "solid-js";
import { skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import { VOICE_CHANNEL } from "../../data/types";
import { type VoiceCall, voice } from "../../data/voice";
import { defineContract, slot } from "../../screen/define";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { useStack } from "../../shell/stack";
import { canInSpace } from "../admin/space-admin";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";
import { useProfileSheet } from "../profile/profile-sheet";
import { closeVoicePrompt, voicePrompt } from "./voice-prompt";

export type VoiceArgs = { space?: string; channel?: string };

export type VoiceMode = "prompt" | "call";

export const VOICE_COPY = {
	fallbackName: "Voice",
	empty: "This voice channel is empty. Join to get the conversation started!",
	minimize: "Minimize call",
	close: "Close",
	joinLabel: (name: string) => `Join ${name}`,
	callLabel: "Voice call",
} as const;

export const voiceScreen = defineContract({
	id: "voice",
	model: (args: VoiceArgs) => {
		const data = useData();
		const stack = useStack();
		const desktop = useOptionalDesktopShell();
		const [joinMuted, setJoinMuted] = createSignal(false);

		const pinned = createMemo<VoiceCall | undefined>(() => {
			const space = args.space;
			const slug = args.channel;
			if (!space || !slug) return undefined;
			const community = data.spaceByKey(space);
			const view = community
				? data.space(community).channelBySlug(slug)
				: undefined;
			return view ? { space, channel: view.space } : undefined;
		});
		const isPinned = () => !!args.channel;

		const liveMode = (): VoiceMode | undefined => {
			if (isPinned()) {
				const current = pinned();
				if (!current) return undefined;
				return voice.current()?.channel === current.channel ? "call" : "prompt";
			}
			if (voicePrompt()) return "prompt";
			if (voice.current() && voice.expanded()) return "call";
			return undefined;
		};
		const liveTarget = (): VoiceCall | undefined => {
			if (isPinned()) return pinned();
			return liveMode() === "prompt" ? voicePrompt() : voice.current();
		};

		const shown = createMemo<
			{ mode: VoiceMode; target: VoiceCall } | undefined
		>((previous) => {
			const mode = liveMode();
			const target = liveTarget();
			return mode && target ? { mode, target } : previous;
		});

		const open = () => liveMode() !== undefined;
		const joined = () => shown()?.mode === "call";
		const target = () => shown()?.target;

		const community = createMemo(() => {
			const current = target();
			return current ? data.spaceByKey(current.space) : undefined;
		});
		const channel = createMemo(() => {
			const current = target();
			const space = community();
			if (!current || !space) return undefined;
			return data.space(space).channelBySlug(skeyOf(current.channel));
		});
		const name = () => channel()?.name ?? VOICE_COPY.fallbackName;
		const participants = () => {
			const current = target();
			return current ? voice.participants(current.channel) : [];
		};
		const tiles = (): VoiceTileData[] => participants();
		const canManage = () => canInSpace(community(), "channel.update");
		const profileSheet = useProfileSheet();
		const openParticipant = (did: string) =>
			profileSheet.open(did, target()?.space);

		const close = () =>
			batch(() => {
				closeVoicePrompt();
				voice.collapse();
			});

		const join = () => {
			const current = isPinned() ? pinned() : voicePrompt();
			if (!current) return;
			batch(() => {
				voice.join(current, { muted: joinMuted() });
				closeVoicePrompt();
				setJoinMuted(false);
			});
		};

		const leave = () => voice.leave();

		const afterClose = (run: (current: VoiceCall) => void) => {
			const current = target();
			if (!current) return;
			close();
			void whenOverlaysClosed().then(() => run(current));
		};

		const chatOpen = () => (desktop ? desktop.voiceChatOpen() : undefined);
		const openChat = () => {
			if (isPinned() && desktop) {
				desktop.setVoiceChatOpen(!desktop.voiceChatOpen());
				return;
			}
			afterClose((current) =>
				stack.push({
					kind: "chat",
					channelType: VOICE_CHANNEL,
					space: current.space,
					channel: skeyOf(current.channel),
				}),
			);
		};

		const openSettings = () =>
			afterClose((current) =>
				stack.push({
					kind: "admin",
					space: current.space,
					page: "channel",
					id: skeyOf(current.channel),
				}),
			);

		return {
			open,
			pinned,
			chatOpen,
			joined,
			name,
			participants,
			openParticipant,
			tiles,
			canManage,
			joinMuted,
			setJoinMuted,
			close,
			join,
			leave,
			openChat,
			openSettings,
			label: () =>
				joined() ? VOICE_COPY.callLabel : VOICE_COPY.joinLabel(name()),
		};
	},
	slots: {
		Header: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<Show
				when={p.platform === "desktop"}
				fallback={
					<VoiceSheetHeader
						title={m.name()}
						closeLabel={m.joined() ? VOICE_COPY.minimize : VOICE_COPY.close}
						onClose={m.close}
						onOpenSettings={m.canManage() ? m.openSettings : undefined}
					/>
				}
			>
				<ChannelHeader
					platform="desktop"
					name={m.name()}
					icon={<VolumeSmallIcon />}
				/>
			</Show>
		)),
		Roster: slot((m) => (
			<VoiceJoinRoster
				channelName={m.name()}
				participants={m.participants()}
				onOpenParticipant={m.openParticipant}
				emptyText={VOICE_COPY.empty}
			/>
		)),
		JoinActions: slot((m) => (
			<VoiceJoinActions
				joinMuted={m.joinMuted()}
				onJoinMutedChange={(next) => {
					m.setJoinMuted(next);
					voice.cue(next ? "mute" : "unmute");
				}}
				onJoin={m.join}
				onOpenChat={m.openChat}
				chatOpen={m.pinned() ? m.chatOpen() : undefined}
			/>
		)),
		Stage: slot((m, p: { portrait?: boolean; shareFocus?: boolean }) => (
			<VoiceStage
				tiles={m.tiles()}
				portrait={p.portrait}
				focusedKey={p.shareFocus ? voice.focusedKey() : undefined}
				onFocusChange={p.shareFocus ? voice.setFocusedKey : undefined}
			/>
		)),
		Controls: slot((m, p: { size?: CallControlSize }) => (
			<CallControls
				size={p.size}
				muted={voice.muted()}
				deafened={voice.deafened()}
				cameraOn={voice.camera()}
				onToggleCamera={voice.toggleCamera}
				onToggleMute={voice.toggleMute}
				onToggleDeafen={voice.toggleDeafen}
				onOpenChat={m.openChat}
				chatOpen={m.pinned() ? m.chatOpen() : undefined}
				onLeave={m.leave}
			/>
		)),
	},
});
