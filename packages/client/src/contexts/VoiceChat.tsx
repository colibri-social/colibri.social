import {
	ConnectionQuality,
	ConnectionState,
	Room,
	RoomEvent,
	type Participant,
} from "livekit-client";
import type { Room as RoomType } from "livekit-client";
import {
	createContext,
	type ParentComponent,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useUserContext } from "./User";
import { useCommunityContext } from "./Community";

export type VoiceChatConnection = {
	state: ConnectionState;
	quality: ConnectionQuality;
	room: RoomType | null;
	/** The rkey of the voice channel we are currently connected to, or null. */
	rkey: string | null;
};

export type VoiceChatStates = {
	camEnabled: boolean;
	screenEnabled: boolean;
	micEnabled: boolean;
	deafened: boolean;
};

export type VoiceChatData = {
	connection: VoiceChatConnection;
	states: VoiceChatStates;
	/** DIDs of participants currently in the connected voice channel. */
	participants: string[];
	/** DIDs of participants currently speaking. */
	activeSpeakers: string[];
};

export type VoiceChatActions = {
	connect: (channelRkey: string) => Promise<void>;
	disconnect: () => void;
	toggleMic: () => void;
	toggleCamera: () => void;
	toggleScreen: () => void;
	toggleDeafen: () => void;
};

/**
 * Tuple shape matching the destructure pattern used at call sites:
 *   const [voiceData, { disconnect, toggleMic, ... }] = useVoiceChatContext();
 */
export type VoiceChatContextValue = [VoiceChatData, VoiceChatActions];

const VoiceChatContext = createContext<VoiceChatContextValue>();

export const VoiceChatContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [voiceData, setVoiceData] = createStore<VoiceChatData>({
		connection: {
			state: ConnectionState.Disconnected,
			quality: ConnectionQuality.Unknown,
			room: null,
			rkey: null,
		},
		states: {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
		},
		participants: [],
		activeSpeakers: [],
	});

	const getRoom = (): Room | null => voiceData.connection.room as Room | null;

	const connect = async (channelRkey: string): Promise<void> => {
		// Already connected to this channel — no-op.
		if (
			voiceData.connection.state === ConnectionState.Connected &&
			voiceData.connection.rkey === channelRkey
		) return;

		// Disconnect from any existing session first.
		getRoom()?.disconnect();

		const channelUri = community().channels.find(
			(c) => c.uri.split("/").pop() === channelRkey,
		)?.uri;
		if (!channelUri) return;

		const tokenRes = await user.xrpc.social.colibri.channel.getVoiceToken(channelUri);
		if (!tokenRes) return;

		const room = new Room();

		room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
			setVoiceData("connection", "state", state);
			if (state === ConnectionState.Disconnected) {
				setVoiceData("connection", { state, room: null, rkey: null, quality: ConnectionQuality.Unknown });
				setVoiceData("participants", []);
				setVoiceData("activeSpeakers", []);
				setVoiceData("states", { camEnabled: false, screenEnabled: false, micEnabled: false, deafened: false });
			}
		});

		room.on(RoomEvent.ConnectionQualityChanged, (_: ConnectionQuality, participant: Participant) => {
			if (participant.identity === user.did) {
				setVoiceData("connection", "quality", participant.connectionQuality);
			}
		});

		room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
			setVoiceData("participants", (prev) => [...prev, participant.identity]);
		});

		room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
			setVoiceData("participants", (prev) =>
				prev.filter((did) => did !== participant.identity),
			);
		});

		room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
			setVoiceData("activeSpeakers", speakers.map((s) => s.identity));
		});

		room.on(RoomEvent.LocalTrackPublished, () => {
			setVoiceData("states", {
				micEnabled: room.localParticipant.isMicrophoneEnabled,
				camEnabled: room.localParticipant.isCameraEnabled,
				screenEnabled: room.localParticipant.isScreenShareEnabled,
			});
		});

		room.on(RoomEvent.LocalTrackUnpublished, () => {
			setVoiceData("states", {
				micEnabled: room.localParticipant.isMicrophoneEnabled,
				camEnabled: room.localParticipant.isCameraEnabled,
				screenEnabled: room.localParticipant.isScreenShareEnabled,
			});
		});

		await room.connect(tokenRes.url, tokenRes.token);
		await room.localParticipant.setMicrophoneEnabled(true);

		const existingParticipants = [
			user.did,
			...Array.from(room.remoteParticipants.values()).map((p) => p.identity),
		];

		setVoiceData("connection", {
			state: ConnectionState.Connected,
			quality: ConnectionQuality.Unknown,
			room,
			rkey: channelRkey,
		});
		setVoiceData("participants", existingParticipants);
		setVoiceData("states", "micEnabled", true);
	};

	const disconnect = (): void => {
		getRoom()?.disconnect();
		setVoiceData("connection", {
			state: ConnectionState.Disconnected,
			quality: ConnectionQuality.Unknown,
			room: null,
			rkey: null,
		});
		setVoiceData("participants", []);
		setVoiceData("activeSpeakers", []);
		setVoiceData("states", {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
		});
	};

	const toggleMic = (): void => {
		const room = getRoom();
		if (!room) return;
		const next = !voiceData.states.micEnabled;
		room.localParticipant.setMicrophoneEnabled(next);
		setVoiceData("states", "micEnabled", next);
	};

	const toggleCamera = (): void => {
		const room = getRoom();
		if (!room) return;
		const next = !voiceData.states.camEnabled;
		room.localParticipant.setCameraEnabled(next);
		setVoiceData("states", "camEnabled", next);
	};

	const toggleScreen = (): void => {
		const room = getRoom();
		if (!room) return;
		const next = !voiceData.states.screenEnabled;
		room.localParticipant.setScreenShareEnabled(next);
		setVoiceData("states", "screenEnabled", next);
	};

	const toggleDeafen = (): void => {
		const room = getRoom();
		if (!room) return;
		const next = !voiceData.states.deafened;
		// Mute/unmute all remote audio tracks.
		for (const participant of room.remoteParticipants.values()) {
			for (const pub of participant.audioTrackPublications.values()) {
				pub.setSubscribed(!next);
			}
		}
		setVoiceData("states", "deafened", next);
	};

	const actions: VoiceChatActions = {
		connect,
		disconnect,
		toggleMic,
		toggleCamera,
		toggleScreen,
		toggleDeafen,
	};

	return (
		<VoiceChatContext.Provider value={[voiceData, actions]}>
			{props.children}
		</VoiceChatContext.Provider>
	);
};

export const useVoiceChatContext = (): VoiceChatContextValue => {
	const ctx = useContext(VoiceChatContext);
	if (!ctx)
		throw new Error(
			"useVoiceChatContext called outside VoiceChatContextProvider",
		);
	return ctx;
};
