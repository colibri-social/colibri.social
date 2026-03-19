import { LIVEKIT_SERVER_URL } from "astro:env/client";
import {
	ConnectionQuality,
	ConnectionState,
	LocalAudioTrack,
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
	createContext,
	createEffect,
	For,
	onCleanup,
	type ParentComponent,
	Show,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { createRnnoiseProcessor } from "@/lib/hooks/createRnnoiseProcessor";
import { fetchToken } from "../components/VoiceChat/livekit";
import { useGlobalContext } from "./GlobalContext";
import { RECORD_IDs } from "@/utils/atproto/lexicons";

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
		isStream: false,
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
			isStream: true,
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
			isStream: false,
		});

		// Screen share as a separate tile
		const remoteScreenShareTrack =
			remote.getTrackPublication(Track.Source.ScreenShare)?.track
				?.mediaStreamTrack ?? null;

		const remoteScreenShareAudioTrack =
			remote.getTrackPublication(Track.Source.ScreenShareAudio)?.track
				?.mediaStreamTrack ?? null;

		if (remoteScreenShareTrack) {
			next.push({
				participant: local,
				videoTrack: remoteScreenShareTrack,
				audioTrack: remoteScreenShareAudioTrack,
				isLocal: false,
				isSpeaking: false,
				isStream: true,
			});
		}
	});

	return next;
}

export type VoiceChatContextData = {
	room: Room | null;
	connectionState: ConnectionState;
	connectionQuality: ConnectionQuality;
	error: string | null;
	camEnabled: boolean;
	micEnabled: boolean;
	screenEnabled: boolean;
	isDeafened: boolean;
	tiles: ParticipantTile[];
	focusedTile: ParticipantTile | null;
	activeSpeakers: Participant[];
	activeRoom: string | null;
	activeRoomName: string | null;
	communityAtUri: string | null;
};

export type VoiceChatContextUtility = {
	rebuildTiles: () => void;
	connect: (
		owner: string,
		community: string,
		channel: string,
		name: string,
	) => Promise<void>;
	disconnect: () => Promise<void>;
	toggleCamera: () => Promise<void>;
	toggleMic: () => Promise<void>;
	toggleDeafen: () => Promise<void>;
	toggleScreen: () => Promise<void>;
	toggleFocusedTile: (tile: ParticipantTile | null) => void;
};

export interface ParticipantTile {
	participant: Participant;
	videoTrack: MediaStreamTrack | null;
	audioTrack: MediaStreamTrack | null;
	isLocal: boolean;
	isSpeaking: boolean;
	isStream: boolean;
}

export const VoiceChatContext =
	createContext<[VoiceChatContextData, VoiceChatContextUtility]>();

const SOUNDS = {
	mute: new Audio("/sounds/mute.mp3"),
	unmute: new Audio("/sounds/unmute.mp3"),
	deafen: new Audio("/sounds/deafen.mp3"),
	undeafen: new Audio("/sounds/undeafen.mp3"),
	screenShared: new Audio("/sounds/screen-shared.mp3"),
	screenUnshared: new Audio("/sounds/screen-unshared.mp3"),
	camOn: new Audio("/sounds/cam-on.mp3"),
	camOff: new Audio("/sounds/cam-off.mp3"),
	join: new Audio("/sounds/join.mp3"),
	leave: new Audio("/sounds/leave.mp3"),
};

export const VoiceChatContextProvider: ParentComponent = (props) => {
	const [globalData, { sendSocketMessage }] = useGlobalContext();

	const playSound = (sound: keyof typeof SOUNDS): void => {
		const audio = SOUNDS[sound];

		audio.currentTime = 0;
		audio.play();
	};

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
			focusedTile: null,
			activeRoom: null,
			activeRoomName: null,
			connectionQuality: ConnectionQuality.Unknown,
			// TODO: Functionality
			isDeafened: false,
			communityAtUri: null,
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
			toggleFocusedTile(tile) {
				if (
					voiceChatContext.focusedTile?.participant.sid ===
						tile?.participant.sid &&
					voiceChatContext.focusedTile?.isStream === tile?.isStream
				)
					setVoiceChatContext("focusedTile", null);
				else setVoiceChatContext("focusedTile", tile);
			},
			async connect(communityOwner, communityRkey, channelRkey, channelName) {
				if (
					voiceChatContext.activeRoom === channelRkey ||
					(!channelRkey && voiceChatContext.activeRoom === channel())
				) {
					return;
				}

				const atUri = `at://${communityOwner}/${RECORD_IDs.COMMUNITY}/${communityRkey}`;

				setVoiceChatContext("error", null);
				setVoiceChatContext("communityAtUri", atUri);

				try {
					const token = await fetchToken(channelRkey ?? channel(), identity());

					setVoiceChatContext("activeRoom", channelRkey ?? channel());
					setVoiceChatContext(
						"activeRoomName",
						channelName ?? channelRkey ?? channel(),
					);

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

					r.on(RoomEvent.ConnectionQualityChanged, (quality) => {
						setVoiceChatContext("connectionQuality", quality);
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
						playSound("join");

						setVoiceChatContext("tiles", newTiles);
					});
					r.on(RoomEvent.ParticipantDisconnected, () => {
						playSound("leave");
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
					// RoomEvent.DataReceived, if you add a chat/data channel

					await r.connect(
						LIVEKIT_SERVER_URL || "ws://localhost:7880",
						token,
						connectOptions,
					);
					setVoiceChatContext("room", r);
					playSound("join");
					sendSocketMessage({
						action: "voice_event",
						community_uri: atUri,
						voice_channel_rkey: channelRkey ?? channel(),
						voice_action: "join",
					});

					const newTiles = rebuildTiles(r, voiceChatContext.activeSpeakers);

					setVoiceChatContext("tiles", newTiles);
				} catch (e) {
					setVoiceChatContext(
						"error",
						e instanceof Error ? e.message : String(e),
					);
					setVoiceChatContext("activeRoom", null);
					setVoiceChatContext("activeRoomName", null);
				}
			},
			async disconnect() {
				const r = voiceChatContext.room;
				if (!r) return;

				sendSocketMessage({
					action: "voice_event",
					community_uri: voiceChatContext.communityAtUri!,
					voice_channel_rkey: voiceChatContext.activeRoom! ?? channel(),
					voice_action: "leave",
				});

				playSound("leave");
				await r.disconnect();
				setVoiceChatContext(() => ({
					room: null,
					tiles: [],
					camEnabled: false,
					micEnabled: false,
					screenEnabled: false,
					activeRoom: null,
					activeRoomName: null,
					activeSpeakers: [],
					connectionQuality: ConnectionQuality.Unknown,
					connectionState: ConnectionState.Disconnected,
					error: null,
					isDeafened: false,
					communityAtUri: null,
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

					if (next) {
						playSound("camOn");
					} else {
						playSound("camOff");
					}

					setVoiceChatContext("tiles", newTiles);
				} catch (e) {
					let errorMessage = e instanceof Error ? e.message : e;

					if (errorMessage === "The object can not be found here.") {
						errorMessage =
							"Unable to access microphone. Please allow the browser to use it in your system settings.";
					}

					setVoiceChatContext("error", `Camera error: ${errorMessage}`);
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
					await r.localParticipant.setMicrophoneEnabled(next, {
						autoGainControl: true,
						noiseSuppression: true,
						echoCancellation: true,
						voiceIsolation: true,
					});
					setVoiceChatContext("micEnabled", next);

					if (next) {
						playSound("unmute");
					} else {
						playSound("mute");
					}

					if (voiceChatContext.isDeafened) {
						setVoiceChatContext("isDeafened", false);
					}
				} catch (e) {
					let errorMessage = e instanceof Error ? e.message : e;

					if (errorMessage === "The object can not be found here.") {
						errorMessage =
							"Unable to access microphone. Please allow the browser to use it in your system settings.";
					}

					setVoiceChatContext("error", `Mic error: ${errorMessage}`);
				}
			},

			/**
			 * Toggles the deafened state.
			 */
			async toggleDeafen() {
				const r = voiceChatContext.room;
				if (!r) return;
				const next = !voiceChatContext.isDeafened;
				try {
					if (next === true) {
						await r.localParticipant.setMicrophoneEnabled(false, {
							autoGainControl: true,
							noiseSuppression: true,
							echoCancellation: true,
							voiceIsolation: true,
						});
					}
					setVoiceChatContext("micEnabled", false);
					setVoiceChatContext("isDeafened", next);

					if (next) {
						playSound("deafen");
					} else {
						playSound("undeafen");
					}
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

					if (next) {
						playSound("screenShared");
					} else {
						playSound("screenUnshared");
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

	createEffect(() => {
		const tiles = voiceChatContext.tiles; // Track

		for (const tile of tiles) {
			const aTrack = tile.audioTrack;
			const participantAudioTrack = document.querySelector<HTMLAudioElement>(
				`#audio-${tile.participant.identity.replaceAll(":", "")}`,
			);

			if (participantAudioTrack && aTrack && !tile.isLocal) {
				participantAudioTrack.srcObject = new MediaStream([aTrack]);
				participantAudioTrack.play().catch(() => {});
			}
		}
	});

	return (
		<VoiceChatContext.Provider value={context}>
			<For each={voiceChatContext.tiles}>
				{(item) => (
					<Show when={!item.isLocal}>
						<audio
							autoplay
							class="hidden"
							muted={voiceChatContext.isDeafened}
							id={`audio-${item.participant.identity.replaceAll(":", "")}`}
						/>
					</Show>
				)}
			</For>
			{props.children}
		</VoiceChatContext.Provider>
	);
};

export const useVoiceChatContext = () => {
	const ctx = useContext(VoiceChatContext);

	if (!ctx) throw new Error("Unable to get message context!");

	return ctx;
};
