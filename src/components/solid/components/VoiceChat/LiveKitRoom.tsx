import { ConnectionState } from "livekit-client";
import { type Component, createEffect, For, Show } from "solid-js";
import {
	useVoiceChatContext,
	type ParticipantTile,
} from "../../contexts/VoiceChatContext";

/**
 * A single participant video tile
 */
const ParticipantVideo: Component<{ tile: ParticipantTile }> = (props) => {
	let videoRef: HTMLVideoElement | undefined;
	let audioRef: HTMLAudioElement | undefined;

	createEffect(() => {
		const vTrack = props.tile.videoTrack;
		if (videoRef && vTrack) {
			videoRef.srcObject = new MediaStream([vTrack]);
			videoRef.play().catch(() => {
				// Autoplay may be blocked.
				// TODO: Click-to-unmute-UI
			});
		} else if (videoRef) {
			videoRef.srcObject = null;
		}
	});

	createEffect(() => {
		const aTrack = props.tile.audioTrack;
		if (audioRef && aTrack && !props.tile.isLocal) {
			audioRef.srcObject = new MediaStream([aTrack]);
			audioRef.play().catch(() => {});
		}
	});

	return (
		<div
			style={{
				position: "relative",
				background: "#0d0d0d",
				border: props.tile.isSpeaking
					? "2px solid #22d3ee"
					: "2px solid #1f1f1f",
				"border-radius": "8px",
				overflow: "hidden",
				"aspect-ratio": "16/9",
				transition: "border-color 0.15s ease",
			}}
		>
			<Show
				when={props.tile.videoTrack}
				fallback={
					<div
						style={{
							display: "flex",
							"align-items": "center",
							"justify-content": "center",
							height: "100%",
							color: "#555",
							"font-size": "14px",
							"font-family": "monospace",
						}}
					>
						{props.tile.participant.identity} — no video
					</div>
				}
			>
				<video
					ref={videoRef}
					autoplay
					muted={props.tile.isLocal}
					playsinline
					style={{ width: "100%", height: "100%", "object-fit": "cover" }}
				/>
			</Show>

			<Show when={!props.tile.isLocal}>
				<audio ref={audioRef} autoplay style={{ display: "none" }} />
			</Show>

			<div
				style={{
					position: "absolute",
					bottom: "8px",
					left: "8px",
					background: "rgba(0,0,0,0.65)",
					color: "#e5e5e5",
					"font-family": "monospace",
					"font-size": "11px",
					padding: "2px 8px",
					"border-radius": "4px",
					"backdrop-filter": "blur(4px)",
				}}
			>
				{props.tile.isLocal
					? `${props.tile.participant.identity} (you)`
					: props.tile.participant.identity}
			</div>
		</div>
	);
};

/**
 * A voice/video room.
 * @todo: Move connection logic to a context so we stay connected while navigating channels/communities
 */
const LiveKitRoom: Component = () => {
	const [
		voiceChatContext,
		{ toggleCamera, toggleMic, toggleScreen, connect, disconnect },
	] = useVoiceChatContext();
	/**
	 * Derived connection state
	 */
	const stateLabel = () => {
		const s = voiceChatContext.connectionState;
		if (s === ConnectionState.Connected) return "Connected";
		if (s === ConnectionState.Connecting) return "Connecting...";
		if (s === ConnectionState.Reconnecting) return "Reconnecting...";
		return "Disconnected";
	};

	const isConnected = () =>
		voiceChatContext.connectionState === ConnectionState.Connected;

	return (
		<div
			style={{
				"min-height": "100%",
				background: "#080808",
				color: "#e5e5e5",
				"font-family":
					"'Berkeley Mono', 'IBM Plex Mono', 'Fira Code', monospace",
				display: "flex",
				"flex-direction": "column",
				gap: "0",
			}}
		>
			<header
				style={{
					padding: "16px 24px",
					"border-bottom": "1px solid #1f1f1f",
					display: "flex",
					"align-items": "center",
					gap: "16px",
					"flex-wrap": "wrap",
				}}
			>
				<span
					style={{
						"font-size": "13px",
						"letter-spacing": "0.08em",
						color: "#888",
					}}
				>
					LIVEKIT DEV
				</span>
				<span
					style={{
						"font-size": "12px",
						color: isConnected() ? "#22d3ee" : "#555",
						"margin-left": "auto",
					}}
				>
					{stateLabel()}
				</span>
			</header>

			<Show when={voiceChatContext.error}>
				<div
					style={{
						padding: "10px 24px",
						background: "#1a0000",
						"border-bottom": "1px solid #3a0000",
						color: "#f87171",
						"font-size": "12px",
					}}
				>
					{voiceChatContext.error}
				</div>
			</Show>

			<div
				style={{
					flex: "1",
					padding: "20px 24px",
					display: "grid",
					"grid-template-columns": "repeat(auto-fill, minmax(320px, 1fr))",
					gap: "12px",
					"align-content": "start",
				}}
			>
				<For each={voiceChatContext.tiles}>
					{(tile) => (
						<ParticipantVideo
							tile={{
								...tile,
								isSpeaking: voiceChatContext.activeSpeakers.some(
									(x) => x.identity === tile.participant.identity,
								),
							}}
						/>
					)}
				</For>

				<Show when={voiceChatContext.tiles.length === 0 && isConnected()}>
					<div
						style={{ color: "#333", "font-size": "13px", padding: "40px 0" }}
					>
						Waiting for participants...
					</div>
				</Show>
			</div>

			<div
				style={{
					padding: "16px 24px",
					"border-top": "1px solid #1f1f1f",
					display: "flex",
					gap: "10px",
					"flex-wrap": "wrap",
					"align-items": "center",
				}}
			>
				<Show
					when={!isConnected()}
					fallback={
						<>
							<ControlButton
								active={voiceChatContext.micEnabled}
								onClick={toggleMic}
								label={voiceChatContext.micEnabled ? "Mic ON" : "Mic OFF"}
								activeColor="#22d3ee"
							/>
							<ControlButton
								active={voiceChatContext.camEnabled}
								onClick={toggleCamera}
								label={voiceChatContext.camEnabled ? "Cam ON" : "Cam OFF"}
								activeColor="#22d3ee"
							/>
							<ControlButton
								active={voiceChatContext.screenEnabled}
								onClick={toggleScreen}
								label={
									voiceChatContext.screenEnabled ? "Stop Share" : "Share Screen"
								}
								activeColor="#a78bfa"
							/>
							<div style={{ "margin-left": "auto" }}>
								<ControlButton
									active={false}
									onClick={disconnect}
									label="Leave"
									activeColor="#f87171"
								/>
							</div>
						</>
					}
				>
					<button
						onClick={connect}
						style={{
							...buttonBase,
							background: "#22d3ee22",
							color: "#22d3ee",
							border: "1px solid #22d3ee55",
						}}
						type="button"
					>
						Join Room
					</button>
				</Show>
			</div>
		</div>
	);
};

const ControlButton: Component<{
	active: boolean;
	onClick: () => void;
	label: string;
	activeColor: string;
}> = (props) => (
	<button
		onClick={props.onClick}
		style={{
			...buttonBase,
			background: props.active ? `${props.activeColor}22` : "#1a1a1a",
			color: props.active ? props.activeColor : "#666",
			border: props.active
				? `1px solid ${props.activeColor}55`
				: "1px solid #2a2a2a",
		}}
		type="button"
	>
		{props.label}
	</button>
);

const buttonBase = {
	padding: "8px 16px",
	"font-family": "inherit",
	"font-size": "12px",
	"letter-spacing": "0.06em",
	"border-radius": "6px",
	cursor: "pointer",
	transition: "all 0.15s ease",
} as const;

export default LiveKitRoom;
