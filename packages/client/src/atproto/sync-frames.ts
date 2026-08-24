import { l } from "@atproto/lex";
import { colibri } from "./lexicons";

const SYNC_DEFS_NSID = "social.colibri.beta.sync.defs";
const FRAME_TYPE_PREFIX = `${SYNC_DEFS_NSID}#`;

export const EVENTS_LXM = "social.colibri.beta.sync.subscribeEvents";
export const EVENTS_PATH = `/xrpc/${EVENTS_LXM}`;

export const AUTH_SUBPROTOCOL = "colibri.auth.bearer";

type FrameOf<S extends l.Validator, Name extends string> = l.InferOutput<S> & {
	$type: `${typeof SYNC_DEFS_NSID}#${Name}`;
};

export type SubscribeFrame = FrameOf<
	typeof colibri.sync.defs.subscribe,
	"subscribe"
>;
export type UnsubscribeFrame = FrameOf<
	typeof colibri.sync.defs.unsubscribe,
	"unsubscribe"
>;
export type HeartbeatFrame = FrameOf<
	typeof colibri.sync.defs.heartbeat,
	"heartbeat"
>;
export type TypingFrame = FrameOf<typeof colibri.sync.defs.typing, "typing">;
export type ViewChannelFrame = FrameOf<
	typeof colibri.sync.defs.viewChannel,
	"viewChannel"
>;
export type SetPresenceFrame = FrameOf<
	typeof colibri.sync.defs.setPresence,
	"setPresence"
>;
export type WroteToFrame = FrameOf<typeof colibri.sync.defs.wroteTo, "wroteTo">;

export type ClientFrame =
	| SubscribeFrame
	| UnsubscribeFrame
	| HeartbeatFrame
	| TypingFrame
	| ViewChannelFrame
	| SetPresenceFrame
	| WroteToFrame;

export type AckFrame = FrameOf<typeof colibri.sync.defs.ack, "ack">;
export type ErrorFrame = FrameOf<typeof colibri.sync.defs.error, "error">;
export type SubscribedFrame = FrameOf<
	typeof colibri.sync.defs.subscribed,
	"subscribed"
>;
export type MessageEventFrame = FrameOf<
	typeof colibri.sync.defs.messageEvent,
	"messageEvent"
>;
export type ReactionEventFrame = FrameOf<
	typeof colibri.sync.defs.reactionEvent,
	"reactionEvent"
>;
export type ChannelEventFrame = FrameOf<
	typeof colibri.sync.defs.channelEvent,
	"channelEvent"
>;
export type CategoryEventFrame = FrameOf<
	typeof colibri.sync.defs.categoryEvent,
	"categoryEvent"
>;
export type RoleEventFrame = FrameOf<
	typeof colibri.sync.defs.roleEvent,
	"roleEvent"
>;
export type MemberEventFrame = FrameOf<
	typeof colibri.sync.defs.memberEvent,
	"memberEvent"
>;
export type CommunityEventFrame = FrameOf<
	typeof colibri.sync.defs.communityEvent,
	"communityEvent"
>;
export type ApplicationEventFrame = FrameOf<
	typeof colibri.sync.defs.applicationEvent,
	"applicationEvent"
>;
export type LabelEventFrame = FrameOf<
	typeof colibri.sync.defs.labelEvent,
	"labelEvent"
>;
export type ModerationEventFrame = FrameOf<
	typeof colibri.sync.defs.moderationEvent,
	"moderationEvent"
>;
export type NotificationEventFrame = FrameOf<
	typeof colibri.sync.defs.notificationEvent,
	"notificationEvent"
>;
export type SeenEventFrame = FrameOf<
	typeof colibri.sync.defs.seenEvent,
	"seenEvent"
>;
export type PresenceEventFrame = FrameOf<
	typeof colibri.sync.defs.presenceEvent,
	"presenceEvent"
>;
export type PreferencesEventFrame = FrameOf<
	typeof colibri.sync.defs.preferencesEvent,
	"preferencesEvent"
>;
export type TypingEventFrame = FrameOf<
	typeof colibri.sync.defs.typingEvent,
	"typingEvent"
>;
export type VoiceEventFrame = FrameOf<
	typeof colibri.sync.defs.voiceEvent,
	"voiceEvent"
>;
export type CommunityProgressEventFrame = FrameOf<
	typeof colibri.sync.defs.communityProgressEvent,
	"communityProgressEvent"
>;

export type ServerFrame =
	| AckFrame
	| ErrorFrame
	| SubscribedFrame
	| MessageEventFrame
	| ReactionEventFrame
	| ChannelEventFrame
	| CategoryEventFrame
	| RoleEventFrame
	| MemberEventFrame
	| CommunityEventFrame
	| ApplicationEventFrame
	| LabelEventFrame
	| ModerationEventFrame
	| NotificationEventFrame
	| SeenEventFrame
	| PresenceEventFrame
	| PreferencesEventFrame
	| TypingEventFrame
	| VoiceEventFrame
	| CommunityProgressEventFrame;

type FrameSchema = {
	$safeParse: (input: unknown) => { success: boolean; value?: unknown };
};

const SERVER_FRAME_NAMES = [
	"ack",
	"error",
	"subscribed",
	"messageEvent",
	"reactionEvent",
	"channelEvent",
	"categoryEvent",
	"roleEvent",
	"memberEvent",
	"communityEvent",
	"applicationEvent",
	"labelEvent",
	"moderationEvent",
	"notificationEvent",
	"seenEvent",
	"presenceEvent",
	"preferencesEvent",
	"typingEvent",
	"voiceEvent",
	"communityProgressEvent",
] as const;

export type ServerFrameName = (typeof SERVER_FRAME_NAMES)[number];

const SERVER_FRAME_SCHEMAS: Record<ServerFrameName, FrameSchema> = {
	ack: colibri.sync.defs.ack,
	error: colibri.sync.defs.error,
	subscribed: colibri.sync.defs.subscribed,
	messageEvent: colibri.sync.defs.messageEvent,
	reactionEvent: colibri.sync.defs.reactionEvent,
	channelEvent: colibri.sync.defs.channelEvent,
	categoryEvent: colibri.sync.defs.categoryEvent,
	roleEvent: colibri.sync.defs.roleEvent,
	memberEvent: colibri.sync.defs.memberEvent,
	communityEvent: colibri.sync.defs.communityEvent,
	applicationEvent: colibri.sync.defs.applicationEvent,
	labelEvent: colibri.sync.defs.labelEvent,
	moderationEvent: colibri.sync.defs.moderationEvent,
	notificationEvent: colibri.sync.defs.notificationEvent,
	seenEvent: colibri.sync.defs.seenEvent,
	presenceEvent: colibri.sync.defs.presenceEvent,
	preferencesEvent: colibri.sync.defs.preferencesEvent,
	typingEvent: colibri.sync.defs.typingEvent,
	voiceEvent: colibri.sync.defs.voiceEvent,
	communityProgressEvent: colibri.sync.defs.communityProgressEvent,
};

export const frameIs = <N extends ServerFrameName>(
	frame: ServerFrame,
	name: N,
): frame is Extract<ServerFrame, { $type: `${typeof SYNC_DEFS_NSID}#${N}` }> =>
	frame.$type === `${SYNC_DEFS_NSID}#${name}`;

const isServerFrameName = (value: string): value is ServerFrameName =>
	(SERVER_FRAME_NAMES as ReadonlyArray<string>).includes(value);

const frameName = (dollarType: string): ServerFrameName | null => {
	if (!dollarType.startsWith(FRAME_TYPE_PREFIX)) return null;
	const name = dollarType.slice(FRAME_TYPE_PREFIX.length);
	return isServerFrameName(name) ? name : null;
};

export const encodeFrame = (frame: ClientFrame): string =>
	JSON.stringify(frame);

export const decodeFrame = (raw: string): ServerFrame | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null) return null;

	const dollarType = (parsed as Record<string, unknown>).$type;
	if (typeof dollarType !== "string") return null;

	const name = frameName(dollarType);
	if (name === null) return null;

	const schema = SERVER_FRAME_SCHEMAS[name];
	const result = schema.$safeParse(parsed);
	if (!result.success) return null;

	return result.value as ServerFrame;
};

export const subscriptionTargets = (
	communities: Iterable<string>,
	channels: Iterable<string>,
): Pick<SubscribeFrame, "communities" | "channels"> => ({
	communities: [...communities].filter(l.isDidString),
	channels: [...channels].filter(l.isSpaceRefString),
});

export const subscribeFrame = (
	params: Pick<SubscribeFrame, "communities" | "channels"> = {},
): SubscribeFrame => ({
	$type: "social.colibri.beta.sync.defs#subscribe",
	...params,
});

export const unsubscribeFrame = (
	params: Pick<UnsubscribeFrame, "communities" | "channels"> = {},
): UnsubscribeFrame => ({
	$type: "social.colibri.beta.sync.defs#unsubscribe",
	...params,
});

export const heartbeatFrame = (): HeartbeatFrame => ({
	$type: "social.colibri.beta.sync.defs#heartbeat",
});

export const typingFrame = (channel: TypingFrame["channel"]): TypingFrame => ({
	$type: "social.colibri.beta.sync.defs#typing",
	channel,
});

export const viewChannelFrame = (
	channel?: ViewChannelFrame["channel"],
): ViewChannelFrame =>
	channel === undefined
		? { $type: "social.colibri.beta.sync.defs#viewChannel" }
		: { $type: "social.colibri.beta.sync.defs#viewChannel", channel };

export const wroteToFrame = (
	space: WroteToFrame["space"],
	rev?: WroteToFrame["rev"],
): WroteToFrame =>
	rev === undefined
		? { $type: "social.colibri.beta.sync.defs#wroteTo", space }
		: { $type: "social.colibri.beta.sync.defs#wroteTo", space, rev };

export const setPresenceFrame = (
	params: Pick<SetPresenceFrame, "onlineState" | "voice"> = {},
): SetPresenceFrame => ({
	$type: "social.colibri.beta.sync.defs#setPresence",
	...params,
});

export const PROGRESS_STEP_LABELS: Record<string, string> = {
	creatingAccount: "Creating account",
	verifyingCredentials: "Verifying credentials",
	creatingSpaces: "Creating spaces",
	writingProfile: "Writing profile",
	creatingOwnerRole: "Creating owner role",
	creatingStarterChannels: "Creating starter channels",
	readingLegacyRepo: "Reading the old community",
	migratingRoles: "Moving roles across",
	migratingMembers: "Moving members across",
	migratingChannels: "Moving channels across",
	migratingCategories: "Moving categories across",
	mirroringMessages: "Mirroring message history",
	done: "Done",
	failed: "Failed",
};

const FALLBACK_PROGRESS_STEP_LABEL = "Working";

export const progressStepLabel = (step: string): string =>
	PROGRESS_STEP_LABELS[step] ?? FALLBACK_PROGRESS_STEP_LABEL;
