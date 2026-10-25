import type { AccessEvent, AccessSource } from "./access";
import type { ActivityProvider } from "./activity-source";
import type { LabelerTransport } from "./badges/labeler";
import type { ChannelSummary } from "./channel-summary";
import type { EmojiEvent, EmojiLibraryEvent, EmojiSource } from "./emoji";
import type { HostingSource } from "./hosting";
import type { PreferenceStore } from "./preferences/store";
import type { Preferences } from "./preferences/types";
import type { SupporterLinkTransport } from "./supporter-link";
import type {
	AttachmentView,
	BlueskyPostView,
	BridgeLink,
	BridgePairingView,
	BridgeRegistrationView,
	BridgeRemoteRoom,
	CategoryPermissions,
	CategoryView,
	ChannelView,
	CommunityView,
	CustomEmojiPolicy,
	Datetime,
	Did,
	Facet,
	GifView,
	LegacyCommunityView,
	MemberView,
	MessageView,
	NotificationView,
	Presence,
	ProfileView,
	ReactionEmojiRef,
	RecordRef,
	RoleView,
	SpaceRef,
	ThreadView,
	UnreadStatus,
	VoiceState,
} from "./types";

export type Page<T> = { items: T[]; cursor?: string };

export type MessagePage = Page<MessageView> & { forwardCursor?: string };

export type ListMessagesParams = {
	channel: SpaceRef;
	limit?: number;
	cursor?: string;
	reverse?: boolean;
	around?: string;
};

export type SendMessageInput = {
	channel: SpaceRef;
	rkey?: string;
	text: string;
	facets?: Facet[];
	parent?: string;
	parentAuthor?: Did;
	attachments?: AttachmentView[];
	suppressedEmbeds?: string[];
};

export type ReactInput = {
	channel: SpaceRef;
	rkey: string;
	emoji: string;
	customEmoji?: ReactionEmojiRef;
	add: boolean;
	author?: Did;
	reaction?: string;
};

export type UploadOptions = {
	onProgress?: (fraction: number) => void;
	signal?: AbortSignal;
};

export type ForwardInput = {
	from: SpaceRef;
	rkey: string;
	to: SpaceRef;
	text?: string;
	facets?: Facet[];
	forwardRkey?: string;
	message?: MessageView;
};

export type Simulation = { slowNetwork: boolean; offline: boolean };

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export type LiveEvent =
	| AccessEvent
	| EmojiEvent
	| EmojiLibraryEvent
	| { $type: "viewerEvent"; profile: ProfileView }
	| {
			$type: "messageEvent";
			event: "create" | "update" | "delete";
			channel: SpaceRef;
			message?: MessageView;
			rkey?: string;
	  }
	| { $type: "messagesMovedEvent"; space: SpaceRef; rkeys: string[] }
	| {
			$type: "reactionEvent";
			event: "create" | "delete";
			channel: SpaceRef;
			target: string;
			emoji: string;
			customEmoji?: ReactionEmojiRef;
			actor: Did;
	  }
	| { $type: "presenceEvent"; did: Did; presence: Presence }
	| { $type: "typingEvent"; did: Did; channel: SpaceRef }
	| { $type: "voiceActivityEvent"; did: Did; speaking: boolean }
	| {
			$type: "voiceStateEvent";
			did: Did;
			channel: SpaceRef;
			voice?: VoiceState;
	  }
	| { $type: "notificationEvent"; notification: NotificationView }
	| {
			$type: "threadEvent";
			event: "create" | "update" | "delete";
			thread: ThreadView;
	  }
	| {
			$type: "channelEvent";
			event: "create" | "update" | "delete";
			community: Did;
			channel: ChannelView;
	  }
	| {
			$type: "categoryEvent";
			event: "create" | "update" | "delete";
			community: Did;
			category: CategoryView;
	  }
	| {
			$type: "communityEvent";
			event: "create" | "update" | "delete";
			community: CommunityView;
	  }
	| {
			$type: "roleEvent";
			event: "create" | "update" | "delete";
			community: Did;
			role: RoleView;
	  }
	| { $type: "channelRemovedEvent"; community: Did; channel: SpaceRef }
	| { $type: "categoryRemovedEvent"; community: Did; rkey: string }
	| { $type: "roleRemovedEvent"; community: Did; rkey: string }
	| { $type: "communityRemovedEvent"; community: Did }
	| { $type: "layoutInvalidatedEvent"; community: Did }
	| { $type: "rolesInvalidatedEvent"; community: Did }
	| { $type: "communityInvalidatedEvent"; community: Did }
	| {
			$type: "memberRolesEvent";
			community: Did;
			subject: Did;
			roles: string[];
	  }
	| { $type: "memberJoinEvent"; community: Did; member: MemberView }
	| { $type: "memberUpdateEvent"; community: Did; member: MemberView }
	| { $type: "memberLeaveEvent"; community: Did; subject: Did }
	| {
			$type: "seenEvent";
			channel?: SpaceRef;
			message?: { did: Did; rkey: string };
			unread: number;
			seenAt: Datetime;
			clearedAt?: Datetime;
	  }
	| {
			$type: "readCursorEvent";
			community: Did;
			cursors: { channel: string; cursor: string }[];
	  }
	| { $type: "preferencesEvent"; preferences: Preferences }
	| {
			$type: "communityProgressEvent";
			step: string;
			completed: number;
			total: number;
			community?: Did;
			message?: string;
	  };

export type ControlsPreferences = {
	showMessagePreviews: boolean;
	swipeLeftAction: "members" | "reply";
	doubleTapEnabled: boolean;
	doubleTapAction: "react" | "editOrReply";
	doubleTapReactionEmoji: string;
	developerMode: boolean;
	confirmVoiceJoin: boolean;
};

export type ThreadAnchor = { space: SpaceRef; did: Did; rkey: string };

export type CreateThreadInput = {
	community: Did;
	channel: SpaceRef;
	name: string;
	anchor?: ThreadAnchor;
};

export type MoveSubject = {
	did: Did;
	collection: string;
	rkey: string;
};

export type MoveMessagesInput = {
	source: SpaceRef;
	destination: SpaceRef;
	subjects: MoveSubject[];
	reason?: string;
};

export type MoveMessagesResult = { batch: string; count: number };

export type RepointInput = {
	thread: SpaceRef;
	channel: SpaceRef;
	anchor?: ThreadAnchor;
};

export const MESSAGE_COLLECTION = "social.colibri.beta.message";
export const MAX_MOVE_SUBJECTS = 50;

export type MemberRolesInput = {
	community: Did;
	subject: Did;
	roles: string[];
};

export type RoleIconBadgeInput = { icon: string; color?: string };

export type RoleEmojiBadgeInput = {
	emoji?: string;
	customEmoji?: { uri: string; cid?: string };
};

export type CreateRoleInput = {
	community: Did;
	name: string;
	permissions: string[];
	color?: string;
	badge?: RoleIconBadgeInput;
	emojiBadge?: RoleEmojiBadgeInput;
	position?: number;
	hoisted?: boolean;
	mentionable?: boolean;
};

export type UpdateRoleInput = {
	community: Did;
	role: string;
	name?: string;
	color?: string;
	badge?: RoleIconBadgeInput;
	emojiBadge?: RoleEmojiBadgeInput;
	removeBadge?: boolean;
	permissions?: string[];
	position?: number;
	hoisted?: boolean;
	mentionable?: boolean;
};

export type VoiceModerationInput = {
	channel: SpaceRef;
	subject: Did;
	muted?: boolean;
	deafened?: boolean;
	disconnect?: boolean;
	moveTo?: SpaceRef;
};

export type MemberModerationInput = {
	community: Did;
	subject: Did;
	reason?: string;
};

export type ProfileTheme = NonNullable<ProfileView["theme"]>;

export type ProfileRecordInput = {
	displayName?: string;
	description?: string;
	pronouns?: string | null;
	avatar?: AttachmentView | null;
	banner?: AttachmentView | null;
	syncBluesky: boolean;
	theme?: ProfileTheme;
	preferredBadge?: string | null;
};

export type ProfileSeed = {
	displayName?: string;
	description?: string;
	pronouns?: string;
	avatar?: Blob;
	banner?: Blob;
	theme?: ProfileTheme;
};

export type ProfileSetup =
	| { complete: true }
	| { complete: false; colibri?: ProfileSeed; bluesky?: ProfileSeed };

export type StatusInput = {
	text?: string;
	emoji?: string;
	customEmoji?: ReactionEmojiRef;
	removeCustomEmoji?: boolean;
	expiresAt?: Datetime;
	removeExpiresAt?: boolean;
	showWhileOffline?: boolean;
	onlineState?: Presence["onlineState"];
};

export type UpdateThreadInput = {
	thread: SpaceRef;
	name?: string;
	visibleToRoles?: string[];
	visibleToMembers?: Did[];
	closed?: boolean;
	locked?: boolean;
};

export type CreateChannelInput = {
	community: Did;
	type: string;
	name: string;
	category?: string;
	description?: string;
	private?: boolean;
	ownerOnly?: boolean;
	allowedRoles?: string[];
	allowedMembers?: Did[];
	visibleToRoles?: string[];
	visibleToMembers?: Did[];
};

export type UpdateChannelInput = {
	channel: SpaceRef;
	name?: string;
	description?: string;
	category?: string;
	ownerOnly?: boolean;
	allowedRoles?: string[];
	allowedMembers?: Did[];
	linkEmbeds?: boolean;
	removeLinkEmbeds?: boolean;
	visibleToRoles?: string[];
	visibleToMembers?: Did[];
};

export type CategoryTarget = { community: Did; category: string };

export type TransferOwnershipInput = { community: Did; subject: Did };

export type TransferOwnershipOutput = {
	owner: MemberView;
	previousOwner: MemberView;
};

export type TransferOwnershipErrorCode =
	| "Forbidden"
	| "CommunityNotFound"
	| "MemberNotFound"
	| "Banned"
	| "AlreadyOwner";

export class TransferOwnershipError extends Error {
	constructor(readonly code: TransferOwnershipErrorCode) {
		super(code);
		this.name = "TransferOwnershipError";
	}
}

export type UpdateCommunityInput = {
	community: Did;
	name?: string;
	description?: string;
	requiresApprovalToJoin?: boolean;
	linkEmbeds?: boolean;
	overrideUserNameColors?: boolean;
	hideOwnerBadge?: boolean;
	customEmoji?: CustomEmojiPolicy;
};

export type CommunityImageKind = "picture" | "banner";

export type PutCommunityImageInput = {
	community: Did;
	kind: CommunityImageKind;
	file: File;
	onProgress?: (fraction: number) => void;
};

export const COMMUNITY_NAME_MAX = 32;
export const COMMUNITY_DESCRIPTION_MAX = 256;

export type CreateCommunityInput = {
	name: string;
	description?: string;
	requiresApprovalToJoin?: boolean;
};

export type BridgeTarget = { community: Did; registration: string };

export type UpdateBridgeInput = BridgeTarget & {
	links?: BridgeLink[];
	enabled?: boolean;
	mirrorModeration?: boolean;
};

export type EmbedSuppressionInput = {
	channel: SpaceRef;
	rkey: string;
	uris: string[];
};

export type PushRegistration =
	| {
			provider: "webpush";
			platform: "web";
			endpoint: string;
			p256dh: string;
			auth: string;
	  }
	| { provider: "fcm"; platform: "android"; token: string }
	| {
			provider: "apns";
			platform: "ios" | "macos";
			token: string;
			environment: "sandbox" | "production";
	  };

export type PushUnregistration =
	| { provider: "webpush"; endpoint: string }
	| { provider: "fcm" | "apns"; token: string };

export type DeletionHost = { name?: string; contactEmail?: string };

export type DeletionStatus = {
	soleOwned: CommunityView[];
	host: DeletionHost;
};

export type DeletionProgress =
	| { step: "records"; done: number; total: number }
	| { step: "server" };

export type DeletionResult = { incomplete: boolean };

export type DataSource = AccessSource &
	EmojiSource &
	HostingSource & {
		viewer: () => ProfileView;
		updateCommunity: (input: UpdateCommunityInput) => Promise<CommunityView>;
		putCommunityImage: (
			input: PutCommunityImageInput,
		) => Promise<CommunityView>;
		deleteCommunityImage: (input: {
			community: Did;
			kind: CommunityImageKind;
		}) => Promise<CommunityView>;
		deleteCommunity: (input: { community: Did }) => Promise<void>;
		leaveCommunity: (input: { community: Did }) => Promise<void>;
		accountHost: () => Promise<string | undefined>;
		getDeletionStatus: () => Promise<DeletionStatus>;
		deleteColibriData: (
			onProgress?: (progress: DeletionProgress) => void,
		) => Promise<DeletionResult>;
		transferOwnership: (
			input: TransferOwnershipInput,
		) => Promise<TransferOwnershipOutput>;
		createCommunity: (input: CreateCommunityInput) => Promise<CommunityView>;
		getCommunity: (community: Did) => Promise<CommunityView>;
		listDiscoverable: () => Promise<CommunityView[]>;
		listLegacyCommunities: () => Promise<LegacyCommunityView[]>;
		migrateLegacyCommunity: (community: Did) => Promise<LegacyCommunityView>;
		listBridges: (community: Did) => Promise<BridgeRegistrationView[]>;
		listBridgeRooms: (input: BridgeTarget) => Promise<BridgeRemoteRoom[]>;
		getBridgePairing: (code: string) => Promise<BridgePairingView>;
		redeemBridgePairing: (input: {
			community: Did;
			code: string;
		}) => Promise<BridgeRegistrationView>;
		updateBridge: (input: UpdateBridgeInput) => Promise<BridgeRegistrationView>;
		revokeBridge: (input: BridgeTarget) => Promise<void>;
		listCommunities: () => Promise<CommunityView[]>;
		listCategories: (community: Did) => Promise<CategoryView[]>;
		listChannels: (community: Did) => Promise<ChannelView[]>;
		listChannelSummaries: (community: Did) => Promise<ChannelSummary[]>;
		listRoles: (community: Did) => Promise<RoleView[]>;
		listMembers: (
			community: Did,
			options?: { limit?: number; cursor?: string },
		) => Promise<Page<MemberView>>;
		listMessages: (params: ListMessagesParams) => Promise<MessagePage>;
		listThreads: (channel: SpaceRef) => Promise<ThreadView[]>;
		getThread: (thread: SpaceRef) => Promise<ThreadView>;
		listThreadMembers: (thread: SpaceRef) => Promise<Did[]>;
		createThread: (input: CreateThreadInput) => Promise<ThreadView>;
		moveMessages: (input: MoveMessagesInput) => Promise<MoveMessagesResult>;
		repoint: (input: RepointInput) => Promise<ThreadView>;
		updateThread: (input: UpdateThreadInput) => Promise<ThreadView>;
		deleteThread: (input: { thread: SpaceRef }) => Promise<void>;
		followThread: (input: {
			thread: SpaceRef;
			follow: boolean;
		}) => Promise<void>;
		createChannel: (input: CreateChannelInput) => Promise<ChannelView>;
		deleteChannel: (input: { channel: SpaceRef }) => Promise<void>;
		updateChannel: (input: UpdateChannelInput) => Promise<ChannelView>;
		createCategory: (
			input: { community: Did; name: string } & CategoryPermissions,
		) => Promise<CategoryView>;
		updateCategory: (
			input: CategoryTarget & { name?: string } & CategoryPermissions,
		) => Promise<CategoryView>;
		deleteCategory: (input: CategoryTarget) => Promise<void>;
		reorderChannels: (
			input: CategoryTarget & { channels: string[] },
		) => Promise<void>;
		reorderCategories: (input: {
			community: Did;
			categories: string[];
		}) => Promise<void>;
		listUnreadStatus: (community: Did) => Promise<UnreadStatus[]>;
		sendMessage: (input: SendMessageInput) => Promise<MessageView>;
		editMessage: (input: {
			channel: SpaceRef;
			rkey: string;
			text: string;
			facets?: Facet[];
		}) => Promise<MessageView>;
		deleteMessage: (input: {
			channel: SpaceRef;
			rkey: string;
		}) => Promise<void>;
		react: (input: ReactInput) => Promise<void>;
		markRead: (channel: SpaceRef, through?: string) => Promise<void>;
		flushReadCursors?: () => Promise<void>;
		setMemberRoles: (input: MemberRolesInput) => Promise<void>;
		createRole: (input: CreateRoleInput) => Promise<RoleView>;
		updateRole: (input: UpdateRoleInput) => Promise<RoleView>;
		deleteRole: (input: { community: Did; role: string }) => Promise<void>;
		putRoleBadgeImage: (input: {
			community: Did;
			role: string;
			file: File;
		}) => Promise<RoleView>;
		kickMember: (input: MemberModerationInput) => Promise<void>;
		banMember: (input: MemberModerationInput) => Promise<void>;
		setHidden: (input: {
			channel: SpaceRef;
			rkey: string;
			hidden: boolean;
		}) => Promise<MessageView>;
		typing: (channel: SpaceRef) => void;
		listNotifications: (params?: {
			limit?: number;
			cursor?: string;
		}) => Promise<Page<NotificationView>>;
		updateSeen: (input: { seenAt: Datetime }) => Promise<void>;
		clearNotifications: (input: { clearedAt: Datetime }) => Promise<void>;
		updateSeenForMessage: (input: {
			channel: SpaceRef;
			message: RecordRef;
		}) => Promise<void>;
		registerPush: (input: PushRegistration) => Promise<void>;
		unregisterPush: (input: PushUnregistration) => Promise<void>;
		subscribe: (listener: (event: LiveEvent) => void) => () => void;
		uploadBlob: (
			file: File,
			options?: UploadOptions,
		) => Promise<AttachmentView>;
		putProfile: (input: ProfileRecordInput) => Promise<ProfileView>;
		loadProfileSetup: () => Promise<ProfileSetup>;
		defaultCommunity: () => Promise<Did | undefined>;
		setStatus: (input: StatusInput) => Promise<Presence>;
		setVoice: (voice: VoiceState | undefined) => Promise<Presence>;
		moderateVoice: (input: VoiceModerationInput) => Promise<void>;
		listGifs: (query?: string) => Promise<GifView[]>;
		gifFavorites: () => GifView[];
		setGifFavorite: (gif: GifView, favorite: boolean) => void;
		forwardMessage: (input: ForwardInput) => Promise<MessageView>;
		setSuppressedEmbeds: (input: EmbedSuppressionInput) => Promise<MessageView>;
		setModeratedEmbeds: (input: EmbedSuppressionInput) => Promise<MessageView>;
		getBlueskyPost: (url: string) => Promise<BlueskyPostView | undefined>;
		getProfile: (actor: Did) => Promise<ProfileView>;
		simulation: () => Simulation;
		setSimulation: (next: Partial<Simulation>) => void;
		preferences: PreferenceStore;
		labeler?: LabelerTransport;
		supporterLink?: SupporterLinkTransport;
		detectActivitySource?: (did: Did) => Promise<ActivityProvider | null>;
	};
