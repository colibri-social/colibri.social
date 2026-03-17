import {
	ConnectionState,
	LocalAudioTrack,
	RemoteParticipant,
	RemoteTrack,
	RemoteTrackPublication,
	Room,
	RoomEvent,
	Track,
	VideoPresets,
	type Participant,
	type RoomConnectOptions,
	type RoomOptions,
} from "livekit-client";
import {
	createContext,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useGlobalContext } from "./GlobalContext";
import { fetchToken } from "../components/VoiceChat/livekit";
import { LIVEKIT_SERVER_URL } from "astro:env/client";
import { createRnnoiseProcessor } from "@/lib/hooks/createRnnoiseProcessor";

/**
 * Re-builds the tiles shown in the UI.
 * @param r
 */
function rebuildTiles(r: Room, activeSpeakers: Participant[]) {
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
		isSpeaking: activeSpeakers.some((x) => x.identity === local.identity),
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
			isSpeaking: activeSpeakers.some((x) => x.identity === remote.identity),
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

	return next;
}

export type VoiceChatContextData = {
	room: Room | null;
	connectionState: ConnectionState;
	error: string | null;
	camEnabled: boolean;
	micEnabled: boolean;
	screenEnabled: boolean;
	tiles: ParticipantTile[];
	activeSpeakers: Participant[];
	activeRoom: string | null;
};

export type VoiceChatContextUtility = {
	rebuildTiles: () => void;
	connect: (channel?: string) => Promise<void>;
	disconnect: () => Promise<void>;
	toggleCamera: () => Promise<void>;
	toggleMic: () => Promise<void>;
	toggleScreen: () => Promise<void>;
};

export interface ParticipantTile {
	participant: Participant;
	videoTrack: MediaStreamTrack | null;
	audioTrack: MediaStreamTrack | null;
	isLocal: boolean;
	isSpeaking: boolean;
}

export const VoiceChatContext =
	createContext<[VoiceChatContextData, VoiceChatContextUtility]>();

export const VoiceChatContextProvider: ParentComponent = (props) => {
	const [globalData] = useGlobalContext();

	const channel = () => window.location.href.split("/")[7];
	const identity = () => globalData.user.sub;

	const [voiceChatContext, setVoiceChatContext] =
		createStore<VoiceChatContextData>({
			activeSpeakers: [],
			camEnabled: false,
			connectionState: ConnectionState.Disconnected,
			error: null,
			micEnabled: false,
			room: null,
			screenEnabled: false,
			tiles: [],
			activeRoom: null,
		});

	const context: [VoiceChatContextData, VoiceChatContextUtility] = [
		voiceChatContext,
		{
			rebuildTiles() {
				if (!voiceChatContext.room) return;

				const newTiles = rebuildTiles(
					voiceChatContext.room,
					voiceChatContext.activeSpeakers,
				);

				setVoiceChatContext("tiles", newTiles);
			},
			async connect(preDeterminedChannel) {
				if (
					voiceChatContext.activeRoom === preDeterminedChannel ||
					(!preDeterminedChannel && voiceChatContext.activeRoom === channel())
				) {
					return;
				}

				setVoiceChatContext("error", null);

				try {
					const token = await fetchToken(
						preDeterminedChannel ?? channel(),
						identity(),
					);

					setVoiceChatContext("activeRoom", preDeterminedChannel ?? channel());

					// TODO: Figure out how to change the video capture options for a single client (different video resolution)
					const roomOptions: RoomOptions = {
						adaptiveStream: true,
						dynacast: true,
						videoCaptureDefaults: VideoPresets.h1080,
						audioCaptureDefaults: {
							echoCancellation: true,
							noiseSuppression: true,
							voiceIsolation: true,
							autoGainControl: true,
						},
					};

					const connectOptions: RoomConnectOptions = {
						autoSubscribe: true,
						maxRetries: 10, // TODO: Error handling
					};

					const r = new Room(roomOptions);

					r.on(RoomEvent.ConnectionStateChanged, (state) => {
						setVoiceChatContext("connectionState", state);
					});

					// A remote track became available and was subscribed to
					r.on(
						RoomEvent.TrackSubscribed,
						(
							_track: RemoteTrack,
							_pub: RemoteTrackPublication,
							_participant: RemoteParticipant,
						) => {
							const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

							setVoiceChatContext("tiles", newTiles);
						},
					);

					r.on(
						RoomEvent.TrackUnsubscribed,
						(
							_track: RemoteTrack,
							_pub: RemoteTrackPublication,
							_participant: RemoteParticipant,
						) => {
							const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

							setVoiceChatContext("tiles", newTiles);
						},
					);

					// Local tracks published (camera, mic, screen)
					r.on(RoomEvent.LocalTrackPublished, (trackPublication) => {
						const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

						setVoiceChatContext("tiles", newTiles);

						if (
							trackPublication.source === Track.Source.Microphone &&
							trackPublication.track instanceof LocalAudioTrack
						) {
							trackPublication.track.setProcessor(createRnnoiseProcessor());
						}
					});
					r.on(RoomEvent.LocalTrackUnpublished, () => {
						const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

						setVoiceChatContext("tiles", newTiles);
					});

					// Participant joins/leaves
					r.on(RoomEvent.ParticipantConnected, () => {
						const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

						setVoiceChatContext("tiles", newTiles);
					});
					r.on(RoomEvent.ParticipantDisconnected, () => {
						const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

						setVoiceChatContext("tiles", newTiles);
					});

					r.on(RoomEvent.ActiveSpeakersChanged, (participants) => {
						setVoiceChatContext("activeSpeakers", participants);
					});

					// Screen share ended by the OS/browser stop button
					r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
						if (pub.source === Track.Source.ScreenShare) {
							setVoiceChatContext("screenEnabled", false);
						}
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
					setVoiceChatContext("room", r);

					const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

					setVoiceChatContext("tiles", newTiles);
				} catch (e) {
					setVoiceChatContext(
						"error",
						e instanceof Error ? e.message : String(e),
					);
					setVoiceChatContext("activeRoom", null);
				}
			},
			async disconnect() {
				const r = voiceChatContext.room;
				if (!r) return;
				await r.disconnect();
				setVoiceChatContext((current) => ({
					...current,
					room: null,
					tiles: [],
					camEnabled: false,
					micEnabled: false,
					screenEnabled: false,
				}));
			},

			/**
			 * Toggles the camera.
			 */
			async toggleCamera() {
				const r = voiceChatContext.room;
				if (!r) return;
				const next = !voiceChatContext.camEnabled;
				try {
					await r.localParticipant.setCameraEnabled(next);
					setVoiceChatContext("camEnabled", next);
					const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

					setVoiceChatContext("tiles", newTiles);
				} catch (e) {
					setVoiceChatContext(
						"error",
						`Camera error: ${e instanceof Error ? e.message : e}`,
					);
				}
			},

			/**
			 * Toggles the microphone.
			 */
			async toggleMic() {
				const r = voiceChatContext.room;
				if (!r) return;
				const next = !voiceChatContext.micEnabled;
				try {
					await r.localParticipant.setMicrophoneEnabled(next);
					setVoiceChatContext("micEnabled", next);
				} catch (e) {
					setVoiceChatContext(
						"error",
						`Mic error: ${e instanceof Error ? e.message : e}`,
					);
				}
			},

			/**
			 * Toggles screen share.
			 */
			async toggleScreen() {
				const r = voiceChatContext.room;
				if (!r) return;
				const next = !voiceChatContext.screenEnabled;
				try {
					if (next) {
						await r.localParticipant.setScreenShareEnabled(true, {
							audio: true, // capture system audio if the browser supports it. TODO: Give option to share
						});
					} else {
						await r.localParticipant.setScreenShareEnabled(false);
					}
					setVoiceChatContext("screenEnabled", next);
					const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

					setVoiceChatContext("tiles", newTiles);
				} catch (_) {
					// User cancelled the share picker
					setVoiceChatContext((current) => ({
						...current,
						error: null,
						screenEnabled: false,
					}));
				}
			},
		},
	];

	// Clean up on component unmount
	onCleanup(() => {
		voiceChatContext.room?.disconnect();
	});

	return (
		<VoiceChatContext.Provider value={context}>
			{props.children}
		</VoiceChatContext.Provider>
	);
};

export const useVoiceChatContext = () => {
	const ctx = useContext(VoiceChatContext);

	if (!ctx) throw new Error("Unable to get message context!");

	return ctx;
};
