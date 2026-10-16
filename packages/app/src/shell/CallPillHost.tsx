import { CallPill, type CallPillPosition } from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { useData } from "../data/store";
import { voice } from "../data/voice";
import { CameraPreviewHost } from "../screens/voice/camera-preview";
import { installVoiceNotices } from "../screens/voice/notices";

const HEADER_HEIGHT = 48;
const BOTTOM_BAR_HEIGHT = 64;

export const CallPillHost = () => {
	installVoiceNotices();
	const data = useData();
	const [position, setPosition] = createSignal<CallPillPosition>("top");

	const community = () => {
		const call = voice.current();
		return call ? data.spaceByKey(call.space) : undefined;
	};
	const channelName = () => {
		const call = voice.current();
		const target = community();
		if (!call || !target) return "Voice";
		return (
			data
				.space(target)
				.channels.value()
				?.find((channel) => channel.space === call.channel)?.name ?? "Voice"
		);
	};

	return (
		<>
			<CameraPreviewHost />
			<Show when={!voice.expanded() && voice.current()}>
				{(call) => (
					<CallPill
						participants={voice.participants(call().channel)}
						channelName={channelName()}
						spaceName={community()?.name}
						startedAt={voice.startedAt() ?? Date.now()}
						muted={voice.muted()}
						deafened={voice.deafened()}
						position={position()}
						onPositionChange={setPosition}
						avoidTop={HEADER_HEIGHT}
						avoidBottom={BOTTOM_BAR_HEIGHT}
						onToggleMute={voice.toggleMute}
						onToggleDeafen={voice.toggleDeafen}
						onOpenCall={voice.expand}
						onLeave={voice.leave}
					/>
				)}
			</Show>
		</>
	);
};
