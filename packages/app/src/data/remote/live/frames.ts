import { frameIs, type ServerFrame } from "@colibri-social/lib";
import type { BlobLocator } from "../../emoji";
import { fromWire } from "../../preferences/wire";
import type { LiveEvent } from "../../source";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	Datetime,
	Did,
	MemberView,
	MessageView,
	NotificationView,
	Presence,
	RoleView,
	SpaceRef,
	ThreadView,
	VoiceState,
} from "../../types";
import { catalogFromWire, libraryFromWire, type WireLibrary } from "../emoji";

const asSpace = (value: string): SpaceRef => value as SpaceRef;
const asDid = (value: string): Did => value as Did;

const CHANGE = ["create", "update", "delete"] as const;
const TOGGLE = ["create", "delete"] as const;

const layoutInvalidated = (community: string): LiveEvent => ({
	$type: "layoutInvalidatedEvent",
	community: asDid(community),
});

const known = <const T extends string>(
	value: string,
	allowed: ReadonlyArray<T>,
): T | null =>
	(allowed as ReadonlyArray<string>).includes(value) ? (value as T) : null;

const messageEvents = (
	frame: Extract<ServerFrame, { $type: `${string}#messageEvent` }>,
): LiveEvent[] => {
	const event = known(frame.event, CHANGE);
	const message = frame.message as MessageView | undefined;
	const rkey = message?.rkey ?? frame.subject?.rkey;
	if (!event) return [];
	if (event !== "delete" && !message) return [];
	if (event === "delete" && !rkey) return [];
	return [
		{
			$type: "messageEvent",
			event,
			channel: asSpace(frame.channel),
			...(message ? { message } : {}),
			...(rkey ? { rkey } : {}),
		},
	];
};

const voiceEvents = (
	frame: Extract<ServerFrame, { $type: `${string}#voiceEvent` }>,
): LiveEvent[] => {
	if (frame.event === "speaking") {
		return [
			{
				$type: "voiceActivityEvent",
				did: asDid(frame.did),
				speaking: frame.speaking ?? false,
			},
		];
	}
	const did = asDid(frame.did);
	const channel = asSpace(frame.channel);
	if (frame.event === "leave") {
		return [
			{ $type: "voiceStateEvent", did, channel },
			{ $type: "voiceActivityEvent", did, speaking: false },
		];
	}
	if (frame.event === "join" || frame.event === "update") {
		const voice = (frame.voice as VoiceState | undefined) ?? { channel };
		return [{ $type: "voiceStateEvent", did, channel, voice }];
	}
	return [];
};

export type FrameContext = { emojiBlobUrl?: BlobLocator };

export const toLiveEvents = (
	frame: ServerFrame,
	context: FrameContext = {},
): LiveEvent[] => {
	if (frameIs(frame, "messageEvent")) return messageEvents(frame);

	if (frameIs(frame, "labelEvent")) {
		if (frame.val !== "moved" || frame.event !== "create") return [];
		return [
			{
				$type: "messagesMovedEvent",
				space: asSpace(frame.space),
				rkeys: [frame.subject.rkey],
			},
		];
	}

	if (frameIs(frame, "reactionEvent")) {
		const event = known(frame.event, TOGGLE);
		if (!event) return [];
		return [
			{
				$type: "reactionEvent",
				event,
				channel: asSpace(frame.channel),
				target: frame.target.rkey,
				emoji: frame.emoji,
				...(frame.customEmoji ? { customEmoji: frame.customEmoji } : {}),
				actor: asDid(frame.actor),
			},
		];
	}

	if (frameIs(frame, "typingEvent")) {
		return [
			{
				$type: "typingEvent",
				did: asDid(frame.did),
				channel: asSpace(frame.channel),
			},
		];
	}

	if (frameIs(frame, "presenceEvent")) {
		return [
			{
				$type: "presenceEvent",
				did: asDid(frame.did),
				presence: frame.presence as Presence,
			},
		];
	}

	if (frameIs(frame, "voiceEvent")) return voiceEvents(frame);

	if (frameIs(frame, "notificationEvent")) {
		return [
			{
				$type: "notificationEvent",
				notification: frame.notification as NotificationView,
			},
		];
	}

	if (frameIs(frame, "seenEvent")) {
		if (!frame.seenAt) return [];
		return [
			{
				$type: "seenEvent",
				...(frame.channel ? { channel: asSpace(frame.channel) } : {}),
				...(frame.message
					? {
							message: {
								did: asDid(frame.message.did),
								rkey: frame.message.rkey,
							},
						}
					: {}),
				unread: frame.unread,
				seenAt: frame.seenAt as Datetime,
				...(frame.clearedAt ? { clearedAt: frame.clearedAt as Datetime } : {}),
			},
		];
	}

	if (frameIs(frame, "readCursorEvent")) {
		if (frame.cursors.length === 0) return [];
		return [
			{
				$type: "readCursorEvent",
				community: asDid(frame.community),
				cursors: frame.cursors.map(({ channel, cursor }) => ({
					channel,
					cursor,
				})),
			},
		];
	}

	if (frameIs(frame, "preferencesEvent")) {
		const { communityOrder, gifFavorites, mutes } = frame.preferences;
		if (!communityOrder || !gifFavorites || !mutes) return [];
		return [
			{ $type: "preferencesEvent", preferences: fromWire(frame.preferences) },
		];
	}

	if (frameIs(frame, "threadEvent")) {
		const event = known(
			frame.event === "activity" ? "update" : frame.event,
			CHANGE,
		);
		if (!frame.thread || !event) return [];
		return [
			{
				$type: "threadEvent",
				event,
				thread: frame.thread as ThreadView,
			},
		];
	}

	if (frameIs(frame, "channelEvent")) {
		const event = known(frame.event, CHANGE);
		if (event === "delete" && !frame.channel) {
			if (!frame.space) return [];
			return [
				{
					$type: "channelRemovedEvent",
					community: asDid(frame.community),
					channel: asSpace(frame.space),
				},
			];
		}
		if (!event) return [];
		if (!frame.channel) return [layoutInvalidated(frame.community)];
		return [
			{
				$type: "channelEvent",
				event,
				community: asDid(frame.community),
				channel: frame.channel as ChannelView,
			},
		];
	}

	if (frameIs(frame, "categoryEvent")) {
		const event = known(frame.event, CHANGE);
		if (event === "delete" && !frame.category) {
			if (!frame.rkey) return [];
			return [
				{
					$type: "categoryRemovedEvent",
					community: asDid(frame.community),
					rkey: frame.rkey,
				},
			];
		}
		if (!event) return [];
		if (!frame.category) return [layoutInvalidated(frame.community)];
		return [
			{
				$type: "categoryEvent",
				event,
				community: asDid(frame.community),
				category: frame.category as CategoryView,
			},
		];
	}

	if (frameIs(frame, "roleEvent")) {
		const event = known(frame.event, CHANGE);
		if (event === "delete" && !frame.role) {
			if (!frame.rkey) return [];
			return [
				{
					$type: "roleRemovedEvent",
					community: asDid(frame.community),
					rkey: frame.rkey,
				},
				layoutInvalidated(frame.community),
			];
		}
		if (!event) return [];
		if (!frame.role) {
			return [
				{ $type: "rolesInvalidatedEvent", community: asDid(frame.community) },
				layoutInvalidated(frame.community),
			];
		}
		return [
			{
				$type: "roleEvent",
				event,
				community: asDid(frame.community),
				role: frame.role as RoleView,
			},
		];
	}

	if (frameIs(frame, "communityEvent")) {
		const event = known(frame.event, ["update", "delete"] as const);
		if (event === "delete" && !frame.view) {
			return [
				{ $type: "communityRemovedEvent", community: asDid(frame.community) },
			];
		}
		if (!event) return [];
		if (!frame.view) {
			return [
				{
					$type: "communityInvalidatedEvent",
					community: asDid(frame.community),
				},
				layoutInvalidated(frame.community),
			];
		}
		return [
			{
				$type: "communityEvent",
				event,
				community: frame.view as CommunityView,
			},
		];
	}

	if (frameIs(frame, "memberEvent")) {
		const member = frame.member;
		if (frame.event === "join") {
			if (!member) return [];
			return [
				{
					$type: "memberJoinEvent",
					community: asDid(frame.community),
					member: member as MemberView,
				},
			];
		}
		if (frame.event === "leave") {
			const subject = frame.subject ?? member?.actor.did;
			if (!subject) return [];
			return [
				{
					$type: "memberLeaveEvent",
					community: asDid(frame.community),
					subject: asDid(subject),
				},
			];
		}
		if (frame.event !== "update" || !member) return [];
		return [
			{
				$type: "memberUpdateEvent",
				community: asDid(frame.community),
				member: member as MemberView,
			},
		];
	}

	if (frameIs(frame, "applicationEvent")) {
		return [
			{
				$type: "accessEvent",
				community: asDid(frame.community),
				kind: "applications",
			},
		];
	}

	if (frameIs(frame, "emojiEvent")) {
		if (!context.emojiBlobUrl) return [];
		return [
			{
				$type: "emojiEvent",
				catalog: catalogFromWire(frame.catalog, context.emojiBlobUrl),
			},
		];
	}

	if (frameIs(frame, "emojiLibraryEvent")) {
		if (!context.emojiBlobUrl) return [];
		return [
			{
				$type: "emojiLibraryEvent",
				library: libraryFromWire(
					frame.library as WireLibrary,
					context.emojiBlobUrl,
				),
			},
		];
	}

	if (frameIs(frame, "communityProgressEvent")) {
		return [
			{
				$type: "communityProgressEvent",
				step: frame.step,
				completed: frame.completed,
				total: frame.total,
				...(frame.community ? { community: asDid(frame.community) } : {}),
				...(frame.message ? { message: frame.message } : {}),
			},
		];
	}

	if (frameIs(frame, "invitationEvent")) {
		return [
			{
				$type: "accessEvent",
				community: asDid(frame.community),
				kind: "invitations",
			},
		];
	}

	return [];
};
