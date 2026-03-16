import { LIVEKIT_SERVER_URL } from "astro:env/client";
import { useParams } from "@solidjs/router";
import {
	ConnectionState,
	type Participant,
	type RemoteParticipant,
	type RemoteTrack,
	type RemoteTrackPublication,
	Room,
	type RoomConnectOptions,
	RoomEvent,
	type RoomOptions,
	Track,
	VideoPresets,
} from "livekit-client";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { fetchToken } from "./livekit";

interface ParticipantTile {
	participant: Participant;
	videoTrack: MediaStreamTrack | null;
	audioTrack: MediaStreamTrack | null;
	isLocal: boolean;
	isSpeaking: boolean;
}

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
	// TODO: Use the channel record key and user DID for this
	const params = useParams();
	const [globalData] = useGlobalContext();

	const roomName = () => params.channel!;
	const identity = () => globalData.user.sub;

	const [room, setRoom] = createSignal<Room | null>(null);
	const [connectionState, setConnectionState] = createSignal<ConnectionState>(
		ConnectionState.Disconnected,
	);
	const [error, setError] = createSignal<string | null>(null);

	// Local publishing state
	const [camEnabled, setCamEnabled] = createSignal(false);
	const [micEnabled, setMicEnabled] = createSignal(false);
	const [screenEnabled, setScreenEnabled] = createSignal(false);

	// Participant tiles (local + remote)
	const [tiles, setTiles] = createSignal<ParticipantTile[]>([]);
	const [activeSpeakers, setActiveSpeakers] = createSignal<Participant[]>([]);

	/**
	 * Re-builds the tiles shown in the UI.
	 * @param r
	 */
	function rebuildTiles(r: Room) {
		const next: ParticipantTile[] = [];

		// Local participant
		const local = r.localParticipant;
		const localVideoTrack =
			local.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack ??
			null;
		const localAudioTrack =
			local.getTrackPublication(Track.Source.Microphone)?.track
				?.mediaStreamTrack ?? null;

		next.push({
			participant: local,
			videoTrack: localVideoTrack,
			audioTrack: localAudioTrack,
			isLocal: true,
			isSpeaking: activeSpeakers().some((x) => x.identity === local.identity),
		});

		// Screen share as a separate tile
		const localScreenShareTrack =
			local.getTrackPublication(Track.Source.ScreenShare)?.track
				?.mediaStreamTrack ?? null;

		const localScreenShareAudioTrack =
			local.getTrackPublication(Track.Source.ScreenShareAudio)?.track
				?.mediaStreamTrack ?? null;

		if (localScreenShareTrack) {
			next.push({
				participant: local,
				videoTrack: localScreenShareTrack,
				audioTrack: localScreenShareAudioTrack,
				isLocal: true,
				isSpeaking: false,
			});
		}

		// Remote participants
		r.remoteParticipants.forEach((remote) => {
			const remoteVideo =
				remote.getTrackPublication(Track.Source.Camera)?.videoTrack
					?.mediaStreamTrack ?? null;
			const remoteAudio =
				remote.getTrackPublication(Track.Source.Microphone)?.audioTrack
					?.mediaStreamTrack ?? null;

			next.push({
				participant: remote,
				videoTrack: remoteVideo,
				audioTrack: remoteAudio,
				isLocal: false,
				isSpeaking: activeSpeakers().some(
					(x) => x.identity === remote.identity,
				),
			});

			// Screen share as a separate tile
			const remoteScreenShareTrack =
				remote.getTrackPublication(Track.Source.ScreenShare)?.track
					?.mediaStreamTrack ?? null;

			const remoteScreenShareAudioTrack =
				remote.getTrackPublication(Track.Source.ScreenShareAudio)?.track
					?.mediaStreamTrack ?? null;

			if (localScreenShareTrack) {
				next.push({
					participant: local,
					videoTrack: remoteScreenShareTrack,
					audioTrack: remoteScreenShareAudioTrack,
					isLocal: false,
					isSpeaking: false,
				});
			}
		});

		setTiles(next);
	}

	/**
	 * Connects to the room.
	 */
	async function connect() {
		setError(null);
		try {
			const token = await fetchToken(roomName(), identity());

			// TODO: Figure out how to change the video capture options for a single client (different video resolution)
			const roomOptions: RoomOptions = {
				adaptiveStream: true,
				dynacast: true,
				videoCaptureDefaults: VideoPresets.h1080,
			};

			const connectOptions: RoomConnectOptions = {
				autoSubscribe: true,
				maxRetries: 10, // TODO: Error handling
			};

			const r = new Room(roomOptions);

			r.on(RoomEvent.ConnectionStateChanged, (state) => {
				setConnectionState(state);
			});

			// A remote track became available and was subscribed to
			r.on(
				RoomEvent.TrackSubscribed,
				(
					_track: RemoteTrack,
					_pub: RemoteTrackPublication,
					_participant: RemoteParticipant,
				) => {
					rebuildTiles(r);
				},
			);

			r.on(
				RoomEvent.TrackUnsubscribed,
				(
					_track: RemoteTrack,
					_pub: RemoteTrackPublication,
					_participant: RemoteParticipant,
				) => {
					rebuildTiles(r);
				},
			);

			// Local tracks published (camera, mic, screen)
			r.on(RoomEvent.LocalTrackPublished, () => rebuildTiles(r));
			r.on(RoomEvent.LocalTrackUnpublished, () => rebuildTiles(r));

			// Participant joins/leaves
			r.on(RoomEvent.ParticipantConnected, () => rebuildTiles(r));
			r.on(RoomEvent.ParticipantDisconnected, () => rebuildTiles(r));

			// TODO: This leads to flickering, make this a state, not
			r.on(RoomEvent.ActiveSpeakersChanged, (participants) =>
				setActiveSpeakers(participants),
			);

			// Screen share ended by the OS/browser stop button
			r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
				if (pub.source === Track.Source.ScreenShare) setScreenEnabled(false);
			});

			// TODO: Handle these events.
			// RoomEvent.Disconnected, show reconnecting UI, attempt rejoin
			// RoomEvent.MediaDevicesError, surface a helpful error message
			// RoomEvent.ConnectionQualityChanged, show quality indicators per participant
			// RoomEvent.DataReceived, if you add a chat/data channel

			await r.connect(
				LIVEKIT_SERVER_URL || "ws://localhost:7880",
				token,
				connectOptions,
			);
			setRoom(r);
			rebuildTiles(r);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	/**
	 * Disconnects from the room.
	 * @returns
	 */
	async function disconnect() {
		const r = room();
		if (!r) return;
		await r.disconnect();
		setRoom(null);
		setTiles([]);
		setCamEnabled(false);
		setMicEnabled(false);
		setScreenEnabled(false);
	}

	// Clean up on component unmount
	onCleanup(() => {
		room()?.disconnect();
	});

	/**
	 * Toggles the camera.
	 */
	async function toggleCamera() {
		const r = room();
		if (!r) return;
		const next = !camEnabled();
		try {
			await r.localParticipant.setCameraEnabled(next);
			setCamEnabled(next);
			rebuildTiles(r);
		} catch (e) {
			setError(`Camera error: ${e instanceof Error ? e.message : e}`);
		}
	}

	/**
	 * Toggles the microphone.
	 */
	async function toggleMic() {
		const r = room();
		if (!r) return;
		const next = !micEnabled();
		try {
			await r.localParticipant.setMicrophoneEnabled(next);
			setMicEnabled(next);
		} catch (e) {
			setError(`Mic error: ${e instanceof Error ? e.message : e}`);
		}
	}

	/**
	 * Toggles screen share.
	 */
	async function toggleScreen() {
		const r = room();
		if (!r) return;
		const next = !screenEnabled();
		try {
			if (next) {
				await r.localParticipant.setScreenShareEnabled(true, {
					audio: true, // capture system audio if the browser supports it. TODO: Give option to share
				});
			} else {
				await r.localParticipant.setScreenShareEnabled(false);
			}
			setScreenEnabled(next);
			rebuildTiles(r);
		} catch (_) {
			// User cancelled the share picker
			setError(null);
			setScreenEnabled(false);
		}
	}

	/**
	 * Derived connection state
	 */
	const stateLabel = () => {
		const s = connectionState();
		if (s === ConnectionState.Connected) return "Connected";
		if (s === ConnectionState.Connecting) return "Connecting...";
		if (s === ConnectionState.Reconnecting) return "Reconnecting...";
		return "Disconnected";
	};

	const isConnected = () => connectionState() === ConnectionState.Connected;

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

			<Show when={error()}>
				<div
					style={{
						padding: "10px 24px",
						background: "#1a0000",
						"border-bottom": "1px solid #3a0000",
						color: "#f87171",
						"font-size": "12px",
					}}
				>
					{error()}
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
				<For each={tiles()}>{(tile) => <ParticipantVideo tile={tile} />}</For>

				<Show when={tiles().length === 0 && isConnected()}>
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
								active={micEnabled()}
								onClick={toggleMic}
								label={micEnabled() ? "Mic ON" : "Mic OFF"}
								activeColor="#22d3ee"
							/>
							<ControlButton
								active={camEnabled()}
								onClick={toggleCamera}
								label={camEnabled() ? "Cam ON" : "Cam OFF"}
								activeColor="#22d3ee"
							/>
							<ControlButton
								active={screenEnabled()}
								onClick={toggleScreen}
								label={screenEnabled() ? "Stop Share" : "Share Screen"}
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
