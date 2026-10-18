import { classifyThrown, createLogger } from "@colibri-social/lib";
import { type MemberMenuVoice, toast } from "@colibri-social/ui";
import { mergeProps } from "solid-js";
import { describeError } from "../../data/error-copy";
import { canModerateVoice } from "../../data/member-permissions";
import type { DataStore } from "../../data/store";
import type { Did, SpaceRef } from "../../data/types";
import { voice } from "../../data/voice";
import { participantVolumes } from "../../data/voice/volumes";
import { openCameraPreview } from "./camera-preview";

const log = createLogger("voice/members");

export const VOICE_MODERATION_COPY = {
	muteFailed: "Couldn't change their microphone",
	deafenFailed: "Couldn't change what they hear",
	disconnectFailed: "Couldn't disconnect them",
} as const;

export type VoiceMemberTarget = { did: string; space: string };

type VoiceMemberStore = Pick<
	DataStore,
	"spaceByKey" | "space" | "viewer" | "preferences" | "source"
>;

type Moderation =
	| { muted: boolean }
	| { deafened: boolean }
	| { disconnect: true };

const failureTitle = (action: Moderation) => {
	if ("muted" in action) return VOICE_MODERATION_COPY.muteFailed;
	if ("deafened" in action) return VOICE_MODERATION_COPY.deafenFailed;
	return VOICE_MODERATION_COPY.disconnectFailed;
};

export const moderateVoice = async (
	data: Pick<DataStore, "source">,
	input: { channel: string; subject: string },
	action: Moderation,
) => {
	try {
		await data.source.moderateVoice({
			channel: input.channel as SpaceRef,
			subject: input.subject as Did,
			...action,
		});
	} catch (thrown) {
		const error = classifyThrown(thrown, { method: "voice.moderate" });
		log.warn("moderating a voice participant failed", { code: error.code });
		const copy = describeError(error);
		toast.error(failureTitle(action), {
			description: copy.description ?? copy.title,
		});
	}
};

const allowedToModerate = (
	data: VoiceMemberStore,
	target: VoiceMemberTarget,
) => {
	const community = data.spaceByKey(target.space);
	if (!community) return false;
	const space = data.space(community);
	const member = space.memberByDid(target.did as Did);
	if (!member) return false;
	return canModerateVoice({
		viewerDid: data.viewer.did,
		viewerIsOwner: !!community.viewer?.isOwner,
		viewerPermissions: community.viewer?.permissions ?? [],
		viewerRoles: community.viewer?.roles ?? [],
		targetDid: member.actor.did,
		targetRoles: member.roles,
		roles: space.roles.value() ?? [],
		requiresApproval: !!community.requiresApprovalToJoin,
	});
};

const hasScreenShare = (did: string) =>
	voice
		.videos()
		.some((video) => video.did === did && video.source === "screen");

export const voiceMemberMenu = (
	data: VoiceMemberStore,
	target: VoiceMemberTarget,
): MemberMenuVoice | undefined => {
	const channel = voice.channelOf(target.did);
	if (!channel) return undefined;
	const self = target.did === data.viewer.did;
	const joined = voice.current()?.channel === channel;
	const menu: MemberMenuVoice = {};
	const volumes = participantVolumes();

	if (joined && !self) {
		menu.volume = volumes.volume(target.did, "voice");
		menu.onVolumeChange = (value) =>
			volumes.setVolume(target.did, "voice", value);
		if (hasScreenShare(target.did)) {
			menu.streamVolume = volumes.volume(target.did, "stream");
			menu.onStreamVolumeChange = (value) =>
				volumes.setVolume(target.did, "stream", value);
		}
	}

	if (joined && self) {
		const view = data.preferences.client().voiceView;
		menu.selfMuted = voice.muted();
		menu.onSelfMutedChange = (muted) => {
			if (voice.muted() !== muted) voice.toggleMute();
		};
		menu.selfDeafened = voice.deafened();
		menu.onSelfDeafenedChange = (deafened) => {
			if (voice.deafened() !== deafened) voice.toggleDeafen();
		};
		menu.onPreviewCamera = openCameraPreview;
		menu.showNonVideoParticipants = view.showNonVideoParticipants;
		menu.onShowNonVideoParticipantsChange = (show) =>
			void data.preferences.setClient({
				voiceView: { showNonVideoParticipants: show },
			});
		menu.showOwnCamera = view.showOwnCamera;
		menu.onShowOwnCameraChange = (show) =>
			void data.preferences.setClient({ voiceView: { showOwnCamera: show } });
	}

	if (!self && allowedToModerate(data, target)) {
		const input = { channel, subject: target.did };
		const state = voice.moderationOf(target.did);
		menu.serverMuted = state.serverMuted;
		menu.onServerMutedChange = (muted) =>
			void moderateVoice(data, input, { muted });
		menu.serverDeafened = state.serverDeafened;
		menu.onServerDeafenedChange = (deafened) =>
			void moderateVoice(data, input, { deafened });
		menu.onDisconnect = () =>
			void moderateVoice(data, input, { disconnect: true });
	}

	return Object.keys(menu).length > 0 ? menu : undefined;
};

export const streamVolumeMenu = (
	data: Pick<DataStore, "viewer">,
	did: string,
): MemberMenuVoice | undefined => {
	const channel = voice.channelOf(did);
	if (!channel || did === data.viewer.did) return undefined;
	if (voice.current()?.channel !== channel || !hasScreenShare(did)) {
		return undefined;
	}
	const volumes = participantVolumes();
	return {
		streamVolume: volumes.volume(did, "stream"),
		onStreamVolumeChange: (value) => volumes.setVolume(did, "stream", value),
	};
};

export const voiceMenuFor = (
	data: VoiceMemberStore,
	target: VoiceMemberTarget | undefined,
) => (target ? voiceMemberMenu(data, target) : undefined);

export const withVoiceMenu = <T extends object>(
	data: VoiceMemberStore,
	target: VoiceMemberTarget,
	actions: T,
) =>
	mergeProps(actions, {
		get voice() {
			return voiceMemberMenu(data, target);
		},
	});
