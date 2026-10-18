import {
	type FloatingCorner,
	VoiceFloatingWindow,
	VoiceStatusPanel,
	type VoiceTileData,
	voiceTileKey,
} from "@colibri-social/ui";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { skeyOf } from "../../data/ids";
import { readStored, writeStored } from "../../data/persist";
import { useData } from "../../data/store";
import { VOICE_CHANNEL } from "../../data/types";
import { voice } from "../../data/voice";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { windowBarHeight } from "../../shell/desktop/window-chrome";
import { useStack } from "../../shell/stack";
import { CameraPreviewHost } from "./camera-preview";
import { installVoiceNotices } from "./notices";
import {
	ScreenShareHost,
	screenShareAvailable,
	screenShareMenu,
	toggleScreenShare,
} from "./screen-share";
import { callTiles } from "./tiles";

const CORNER_KEY = "colibri:voice-floating-corner";
const WIDTH_KEY = "colibri:voice-floating-width";

const CORNERS: readonly FloatingCorner[] = ["tl", "tr", "bl", "br"];

const storedCorner = (): FloatingCorner => {
	const raw = readStored(CORNER_KEY);
	return CORNERS.includes(raw as FloatingCorner)
		? (raw as FloatingCorner)
		: "br";
};

const storedWidth = () => {
	const raw = Number(readStored(WIDTH_KEY));
	return Number.isFinite(raw) && raw > 0 ? raw : undefined;
};

export default function VoiceDock() {
	installVoiceNotices();
	const data = useData();
	const stack = useStack();
	const shell = useOptionalDesktopShell();
	const [corner, setCorner] = createSignal<FloatingCorner>(storedCorner());
	const [width, setWidth] = createSignal(storedWidth());
	const call = createMemo(() => {
		const current = voice.current();
		if (!current) return undefined;
		const community = data.spaceByKey(current.space);
		const view = community
			? data.space(community).channelBySlug(skeyOf(current.channel))
			: undefined;
		return { ...current, community, view };
	});

	const viewingCall = () => {
		const current = call();
		const chat = shell?.stack.route().chat;
		return (
			!!current &&
			!!chat &&
			chat.space === current.space &&
			chat.channel === skeyOf(current.channel)
		);
	};

	const participants = createMemo((): VoiceTileData[] => {
		const current = call();
		if (!current) return [];
		return callTiles({
			participants: voice.participants(current.channel),
			videos: voice.videos(),
			viewer: data.viewer.did,
			view: data.preferences.client().voiceView,
		});
	});
	const [lastSpeaker, setLastSpeaker] = createSignal<string>();
	createEffect(() => {
		const speaking = participants().find((tile) => tile.speaking);
		if (speaking) setLastSpeaker(speaking.id);
	});
	const subject = createMemo((): VoiceTileData | undefined => {
		const tiles = participants();
		const focused = voice.focusedKey();
		return (
			(focused
				? tiles.find((tile) => voiceTileKey(tile) === focused)
				: undefined) ??
			tiles.find((tile) => tile.speaking && tile.kind !== "screen") ??
			tiles.find((tile) => tile.kind === "screen") ??
			tiles.find((tile) => tile.id === lastSpeaker()) ??
			tiles.find((tile) => tile.id === data.viewer.did) ??
			tiles[0]
		);
	});

	const hasVideo = () => voice.camera() || voice.videos().length > 0;
	const floating = () =>
		voice.connection().state !== "disconnected" &&
		!voice.floatingDismissed() &&
		hasVideo() &&
		!viewingCall();

	const openCall = () => {
		const current = call();
		if (!current) return;
		stack.push({
			kind: "chat",
			channelType: VOICE_CHANNEL,
			space: current.space,
			channel: skeyOf(current.channel),
		});
	};

	return (
		<Show when={call()}>
			{(current) => (
				<>
					<CameraPreviewHost />
					<ScreenShareHost />
					<VoiceStatusPanel
						state={voice.connection().state}
						quality={voice.connection().quality}
						latency={voice.connection().latency}
						channelName={current().view?.name}
						spaceName={current().community?.name}
						muted={voice.muted()}
						deafened={voice.deafened()}
						cameraOn={voice.camera()}
						screenSharing={voice.screenSharing()}
						class="border-t-0"
						onDisconnect={voice.leave}
						onToggleMute={voice.toggleMute}
						onToggleDeafen={voice.toggleDeafen}
						onToggleCamera={voice.toggleCamera}
						onToggleScreenShare={
							screenShareAvailable()
								? () => void toggleScreenShare()
								: undefined
						}
						screenShareMenu={
							screenShareAvailable() ? screenShareMenu() : undefined
						}
						onOpenCall={openCall}
						onShowOverlay={
							voice.floatingDismissed()
								? () => voice.setFloatingDismissed(false)
								: undefined
						}
					/>
					<Show when={floating() && subject()}>
						{(tile) => (
							<VoiceFloatingWindow
								tile={tile()}
								channelName={current().view?.name ?? "Voice"}
								corner={corner()}
								onCornerChange={(next) => {
									setCorner(next);
									writeStored(CORNER_KEY, next);
								}}
								width={width()}
								onWidthChange={(next) => {
									setWidth(next);
									writeStored(WIDTH_KEY, String(next));
								}}
								insets={{ top: windowBarHeight() }}
								cameraOn={voice.camera()}
								onToggleCamera={voice.toggleCamera}
								screenSharing={voice.screenSharing()}
								onToggleScreenShare={voice.stopScreenShare}
								onReturn={openCall}
								onDismiss={() => voice.setFloatingDismissed(true)}
								onDisconnect={voice.leave}
							/>
						)}
					</Show>
				</>
			)}
		</Show>
	);
}
