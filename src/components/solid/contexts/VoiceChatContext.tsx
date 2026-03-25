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
	type Component,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	type ParentComponent,
	Show,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { createRnnoiseProcessor } from "@/lib/hooks/createRnnoiseProcessor";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { fetchToken } from "../components/VoiceChat/livekit";
import { useGlobalContext } from "./GlobalContext";
import {
	type UserPreferencesContextData,
	usePreferencesContext,
} from "./UserPreferencesContext";

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
	connection: {
		room: Room | null;
		rkey: string | null;
		communityAtUri: string | null;
		state: ConnectionState;
		quality: ConnectionQuality;
		error: string | null;
		tiles: Array<ParticipantTile>;
		focusedTile: ParticipantTile | null;
		participants: Participant[];
	};
	states: {
		screenEnabled: boolean;
		camEnabled: boolean;
	};
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

const makeGainNode = (ctx: AudioContext, gain: number) => {
	const gainNode = ctx.createGain();
	gainNode.gain.value = gain;

	return gainNode;
};

const makeInitialState = () => ({
	connection: {
		room: null,
		rkey: null,
		communityAtUri: null,
		state: ConnectionState.Disconnected,
		quality: ConnectionQuality.Unknown,
		error: null,
		tiles: [],
		focusedTile: null,
		participants: [],
	},
	states: {
		screenEnabled: false,
		camEnabled: false,
	},
});

const ParticipantAudio: Component<{
	tile: ParticipantTile;
	userPreferences: UserPreferencesContextData;
}> = (props) => {
	let audioRef: HTMLAudioElement | undefined;

	const identity = () => props.tile.participant.identity;
	const type = () => (props.tile.isStream ? "screen" : "voice");

	const targetVolume = createMemo(() => {
		const override =
			props.userPreferences.voice.participantVolumeOverrides[identity()]?.[
				type()
			];
		if (override?.muted) return 0;
		return override?.volume ?? 1;
	});

	createEffect(() => {
		const aTrack = props.tile.audioTrack;
		if (!aTrack || !audioRef || props.tile.isLocal) return;

		audioRef.srcObject = new MediaStream([aTrack]);
		audioRef.volume = 0; // Keep the stream alive

		audioRef.play().catch(() => {});

		const stream = (audioRef as any).captureStream?.() as
			| MediaStream
			| undefined;
		if (!stream) return;

		const ctx = new AudioContext({
			latencyHint: "interactive",
			sampleRate: 48000,
		});
		const source = ctx.createMediaStreamSource(stream);
		const gainNode = makeGainNode(
			ctx,
			targetVolume() * props.userPreferences.voice.output.volume,
		);

		source.connect(gainNode);
		gainNode.connect(ctx.destination); // plays through speaker

		// createEffect(() => {
		// 	gainNode.gain.setTargetAtTime(
		// 		targetVolume() * props.userPreferences.voice.output.volume,
		// 		ctx.currentTime,
		// 		0.05,
		// 	);
		// });

		onCleanup(() => {
			source.disconnect();
			gainNode.disconnect();
			ctx.close();
		});
	});

	return (
		<Show when={!props.tile.isLocal}>
			<audio
				ref={audioRef}
				autoplay
				class="hidden"
				muted={
					!props.userPreferences.voice.output.enabled || props.tile.isLocal
				}
				id={`audio-${identity().replaceAll(":", "")}`}
			/>
		</Show>
	);
};

export const VoiceChatContextProvider: ParentComponent = (props) => {
	const [userPreferences, setUserPreferences] = usePreferencesContext();
	const [globalData, { sendSocketMessage }] = useGlobalContext();
	const [intervalVar, setIntervalVar] = createSignal<NodeJS.Timeout>();

	const playSound = (sound: keyof typeof SOUNDS): void => {
		const audio = SOUNDS[sound];

		audio.currentTime = 0;
		audio.play();
	};

	const channel = () => window.location.href.split("/")[7];
	const identity = () => globalData.user.sub;

	const [voiceChatContext, setVoiceChatContext] =
		createStore<VoiceChatContextData>(makeInitialState());

	const context: [VoiceChatContextData, VoiceChatContextUtility] = [
		voiceChatContext,
		{
			rebuildTiles() {
				if (!voiceChatContext.connection.room) return;

				const newTiles = rebuildTiles(
					voiceChatContext.connection.room,
					voiceChatContext.connection.participants,
				);

				setVoiceChatContext("connection", {
					tiles: newTiles,
				});
			},
			toggleFocusedTile(tile) {
				if (
					voiceChatContext.connection.focusedTile?.participant.sid ===
						tile?.participant.sid &&
					voiceChatContext.connection.focusedTile?.isStream === tile?.isStream
				) {
					setVoiceChatContext("connection", {
						focusedTile: null,
					});
				} else {
					setVoiceChatContext("connection", {
						focusedTile: tile,
					});
				}
			},
			async connect(communityOwner, communityRkey, channelRkey, channelName) {
				if (
					voiceChatContext.connection.rkey === channelRkey ||
					(!channelRkey && voiceChatContext.connection.rkey === channel())
				) {
					return;
				}

				try {
					const rkey = channelRkey ?? channel();
					const usedChannelName = channelName ?? rkey;
					const atUri = `at://${communityOwner}/${RECORD_IDs.COMMUNITY}/${communityRkey}`;

					setVoiceChatContext("connection", {
						error: null,
						rkey: rkey,
						communityAtUri: atUri,
					});

					const token = await fetchToken(usedChannelName, identity());

					// TODO(launch): Update noise surpression and echo cancellation when value changes
					const roomOptions: RoomOptions = {
						adaptiveStream: false,
						dynacast: true,
						videoCaptureDefaults: VideoPresets.h1080,
						audioCaptureDefaults: {
							echoCancellation: true,
							noiseSuppression: userPreferences.voice.input.noiseSuppression,
							voiceIsolation: userPreferences.voice.input.noiseSuppression,
							autoGainControl: true,
							deviceId:
								userPreferences.voice.input.preferredDeviceId ?? undefined,
						},
						audioOutput: {
							deviceId:
								userPreferences.voice.output.preferredDeviceId ?? undefined,
						},
					};

					const connectOptions: RoomConnectOptions = {
						autoSubscribe: true,
						maxRetries: 10, // TODO(launch): Error handling
					};

					const r = new Room(roomOptions);

					r.on(RoomEvent.ConnectionStateChanged, (state) => {
						setVoiceChatContext("connection", { state });
					});

					r.on(RoomEvent.ConnectionQualityChanged, (quality) => {
						setVoiceChatContext("connection", { quality });
					});

					// A remote track became available and was subscribed to
					r.on(
						RoomEvent.TrackSubscribed,
						(
							_track: RemoteTrack,
							_pub: RemoteTrackPublication,
							_participant: RemoteParticipant,
						) => {
							const newTiles = rebuildTiles(
								r,
								voiceChatContext.connection.participants,
							);

							setVoiceChatContext("connection", { tiles: newTiles });
						},
					);

					r.on(
						RoomEvent.TrackUnsubscribed,
						(
							_track: RemoteTrack,
							_pub: RemoteTrackPublication,
							_participant: RemoteParticipant,
						) => {
							const newTiles = rebuildTiles(
								r,
								voiceChatContext.connection.participants,
							);

							setVoiceChatContext("connection", { tiles: newTiles });
						},
					);

					// Local tracks published (camera, mic, screen)
					r.on(RoomEvent.LocalTrackPublished, (trackPublication) => {
						const newTiles = rebuildTiles(
							r,
							voiceChatContext.connection.participants,
						);

						setVoiceChatContext("connection", { tiles: newTiles });

						if (
							trackPublication.source === Track.Source.Microphone &&
							trackPublication.track instanceof LocalAudioTrack &&
							userPreferences.voice.input.noiseSuppression
						) {
							trackPublication.track.setProcessor(createRnnoiseProcessor());
						}
					});

					r.on(RoomEvent.LocalTrackUnpublished, () => {
						const newTiles = rebuildTiles(
							r,
							voiceChatContext.connection.participants,
						);

						setVoiceChatContext("connection", { tiles: newTiles });
					});

					// Participant joins/leaves
					r.on(RoomEvent.ParticipantConnected, () => {
						playSound("join");
						const newTiles = rebuildTiles(
							r,
							voiceChatContext.connection.participants,
						);

						setVoiceChatContext("connection", { tiles: newTiles });
					});

					r.on(RoomEvent.ParticipantDisconnected, () => {
						playSound("leave");
						const newTiles = rebuildTiles(
							r,
							voiceChatContext.connection.participants,
						);

						setVoiceChatContext("connection", { tiles: newTiles });
					});

					r.on(RoomEvent.ActiveSpeakersChanged, (participants) => {
						setVoiceChatContext("connection", {
							participants,
						});
					});

					// Screen share ended by the OS/browser stop button
					r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
						if (pub.source === Track.Source.ScreenShare) {
							playSound("screenUnshared");
							setVoiceChatContext("states", {
								screenEnabled: false,
							});
						}
					});

					// TODO(launch): Handle these events.
					// RoomEvent.Disconnected, show reconnecting UI, attempt rejoin
					// RoomEvent.MediaDevicesError, surface a helpful error message
					// RoomEvent.DataReceived, if you add a chat/data channel

					// TODO(launch): Show loading state from here
					await r.connect(
						LIVEKIT_SERVER_URL || "ws://localhost:7880",
						token,
						connectOptions,
					);

					playSound("join");

					sendSocketMessage({
						action: "voice_event",
						community_uri: atUri,
						voice_channel_rkey: channelRkey ?? channel(),
						voice_action: "join",
					});

					const interval = setInterval(() => {
						sendSocketMessage({
							action: "voice_event",
							community_uri: atUri,
							voice_channel_rkey: channelRkey ?? channel(),
							voice_action: "join",
						});
					}, 3000 * 60);

					setIntervalVar(interval);

					const newTiles = rebuildTiles(
						r,
						voiceChatContext.connection.participants,
					);

					setVoiceChatContext("connection", { tiles: newTiles, room: r });
				} catch (e) {
					setVoiceChatContext("connection", {
						error: e instanceof Error ? e.message : String(e),
						room: null,
					});
				}
			},
			async disconnect() {
				if (intervalVar()) clearInterval(intervalVar());

				const r = voiceChatContext.connection.room;

				if (!r) return;

				console.log("clearing");

				sendSocketMessage({
					action: "voice_event",
					community_uri: voiceChatContext.connection.communityAtUri!,
					voice_channel_rkey:
						voiceChatContext.connection.room!.name ?? channel(),
					voice_action: "leave",
				});

				playSound("leave");

				await r.disconnect();

				setVoiceChatContext(makeInitialState());
			},

			/**
			 * Toggles the camera.
			 */
			async toggleCamera() {
				const r = voiceChatContext.connection.room;

				if (!r) return;

				const next = !voiceChatContext.states.camEnabled;

				try {
					await r.localParticipant.setCameraEnabled(next);
					const newTiles = rebuildTiles(
						r,
						voiceChatContext.connection.participants,
					);

					if (next) {
						playSound("camOn");
					} else {
						playSound("camOff");
					}

					setVoiceChatContext("states", {
						camEnabled: next,
					});
					setVoiceChatContext("connection", {
						tiles: newTiles,
					});
				} catch (e) {
					let errorMessage = e instanceof Error ? e.message : e;

					if (errorMessage === "The object can not be found here.") {
						errorMessage =
							"Unable to access camera. Please allow the browser to use it in your system settings.";
					}

					if (errorMessage === "Failed to allocate videosource") {
						errorMessage =
							"Unable to access camera. Is it already being used by a different app or not connected?";
					}

					setVoiceChatContext("connection", {
						error: `Camera error: ${errorMessage}`,
					});
				}
			},

			/**
			 * Toggles the microphone.
			 */
			async toggleMic() {
				const r = voiceChatContext.connection.room;

				if (!r) return;

				const next = !userPreferences.voice.input.enabled;

				try {
					await r.localParticipant.setMicrophoneEnabled(
						next,
						next
							? {
									autoGainControl: true,
									noiseSuppression:
										userPreferences.voice.input.noiseSuppression,
									echoCancellation: true,
									voiceIsolation: userPreferences.voice.input.noiseSuppression,
								}
							: undefined,
					);

					if (next) {
						playSound("unmute");
					} else {
						playSound("mute");
					}

					setUserPreferences("voice", (current) => ({
						...current,
						input: {
							...current.input,
							enabled: next,
						},
						output: {
							...current.output,
							enabled:
								current.output.enabled === false && next
									? true
									: current.output.enabled,
						},
					}));
				} catch (e) {
					let errorMessage = e instanceof Error ? e.message : e;

					if (errorMessage === "The object can not be found here.") {
						errorMessage =
							"Unable to access microphone. Please allow the browser to use it in your system settings.";
					}

					setVoiceChatContext("connection", {
						error: `Mic error: ${errorMessage}`,
					});
				}
			},

			/**
			 * Toggles the deafened state.
			 */
			async toggleDeafen() {
				const r = voiceChatContext.connection.room;
				if (!r) return;
				const next = !userPreferences.voice.output.enabled;
				try {
					if (next === true) {
						await r.localParticipant.setMicrophoneEnabled(false, {
							autoGainControl: true,
							noiseSuppression: userPreferences.voice.input.noiseSuppression,
							echoCancellation: true,
							voiceIsolation: userPreferences.voice.input.noiseSuppression,
						});
					}

					if (next) {
						playSound("undeafen");
					} else {
						playSound("deafen");
					}

					setUserPreferences("voice", (current) => ({
						...current,
						input: {
							...current.input,
							enabled: false,
						},
						output: {
							...current.output,
							enabled: next,
						},
					}));
				} catch (e) {
					const errorMessage = e instanceof Error ? e.message : e;

					setVoiceChatContext("connection", {
						error: `Mic error: ${errorMessage}`,
					});
				}
			},

			/**
			 * Toggles screen share.
			 */
			async toggleScreen() {
				const r = voiceChatContext.connection.room;
				if (!r) return;
				const next = !voiceChatContext.states.screenEnabled;
				try {
					if (next) {
						await r.localParticipant.setScreenShareEnabled(true, {
							audio: true, // capture system audio if the browser supports it. TODO(app): Give option to share
						});
					} else {
						await r.localParticipant.setScreenShareEnabled(false);
					}

					if (next) {
						playSound("screenShared");
					} else {
						playSound("screenUnshared");
					}

					setVoiceChatContext("states", {
						screenEnabled: next,
					});
					const newTiles = rebuildTiles(
						r,
						voiceChatContext.connection.participants,
					);

					setVoiceChatContext("connection", { tiles: newTiles });
				} catch (_) {
					// User cancelled the share picker
					setVoiceChatContext((current) => ({
						...current,
						connection: {
							...current.connection,
							error: null,
						},
						states: {
							...current.states,
							screenEnabled: false,
						},
					}));
				}
			},
		},
	];

	// Clean up on component unmount
	onCleanup(() => {
		voiceChatContext.connection.room?.disconnect();
	});

	createEffect(async () => {
		const usesNoiseSuppression = userPreferences.voice.input.noiseSuppression;
		const preferredDeviceId = userPreferences.voice.input.preferredDeviceId;
		const room = voiceChatContext.connection.room;

		if (!room) return;

		const desiredEnabled = !!userPreferences.voice.input.enabled;
		const micTrackPub = room.localParticipant.getTrackPublication(
			Track.Source.Microphone,
		);
		const micTrack = micTrackPub?.track as LocalAudioTrack | undefined;

		const currentEnabled = micTrackPub?.isMuted === false;
		if (currentEnabled !== desiredEnabled) {
			await room.localParticipant.setMicrophoneEnabled(
				desiredEnabled,
				desiredEnabled
					? {
							noiseSuppression: usesNoiseSuppression,
							echoCancellation: true,
							autoGainControl: true,
							deviceId: preferredDeviceId,
						}
					: undefined,
			);
		}

		if (
			desiredEnabled &&
			usesNoiseSuppression &&
			micTrack instanceof LocalAudioTrack
		) {
			await micTrack.setProcessor(createRnnoiseProcessor());
		} else {
			await micTrack?.stopProcessor();
		}
	});

	createEffect(async () => {
		const preferredSpeaker = userPreferences.voice.output.preferredDeviceId;
		const room = voiceChatContext.connection.room;

		if (!room || !preferredSpeaker) return;

		await room.switchActiveDevice("audiooutput", preferredSpeaker);
	});

	createEffect(async () => {
		const preferredCamera = userPreferences.voice.camera.preferredDeviceId;
		const room = voiceChatContext.connection.room;

		if (!room || !preferredCamera) return;

		await room.switchActiveDevice("videoinput", preferredCamera);
		setVoiceChatContext("connection", {
			error: null,
		});
	});

	return (
		<VoiceChatContext.Provider value={context}>
			<For each={voiceChatContext.connection.tiles}>
				{(item) => (
					<ParticipantAudio
						tile={item}
						// voiceChatContext={voiceChatContext}
						userPreferences={userPreferences}
					/>
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
