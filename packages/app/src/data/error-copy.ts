import {
	createErrorCopy,
	type ErrorCopy,
	type ErrorCopyCatalog,
} from "@colibri-social/lib";
import type { VoiceEndReason, VoiceNotice } from "./voice/types";

const TRY_AGAIN: ErrorCopy = {
	title: "Something went wrong",
	description: "Give it another try. If it keeps happening, restart Colibri.",
};

const SIGN_IN_AGAIN: ErrorCopy = {
	title: "Please sign in again",
	description: "You've been signed out. Your messages and Spaces are safe.",
};

const NO_PERMISSION: ErrorCopy = {
	title: "You can't do that here",
	description:
		"Your role in this Space doesn't allow it. A moderator can change that.",
};

const CONNECTION: ErrorCopy = {
	title: "Can't connect right now",
	description:
		"Check your internet connection. Colibri keeps trying in the background.",
};

const COLIBRI_HICCUP: ErrorCopy = {
	title: "Colibri is having a hiccup",
	description: "This is on our end. Try again in a minute.",
};

const FEATURE_UNAVAILABLE = (feature: string): ErrorCopy => ({
	title: `${feature} isn't available right now`,
	description: "Try again later.",
});

export const APP_ERROR_COPY: ErrorCopyCatalog = {
	ActorNotFound: {
		title: "We couldn't find that person",
		description: "Check the username for typos and try again.",
	},
	AlreadyBanned: { title: "They're already banned from this Space" },
	AlreadyExists: {
		title: "That name is already taken",
		description: "Try a different one.",
	},
	AlreadyMember: { title: "They're already in this Space" },
	ApplicationNotFound: {
		title: "That request was already handled",
		description: "Someone else may have accepted or declined it.",
	},
	Banned: {
		title: "You can't join this Space",
		description: "You've been banned from it.",
	},
	BlobNotFound: {
		title: "That file isn't there anymore",
		description: "It may have been deleted.",
	},
	CategoryNotFound: {
		title: "That category isn't there anymore",
		description: "It may have been deleted.",
	},
	ChannelNotFound: {
		title: "That channel isn't there anymore",
		description: "It may have been deleted, or you no longer have access.",
	},
	CommunityNotFound: {
		title: "That Space isn't there anymore",
		description: "It may have been deleted, or you no longer have access.",
	},
	CredentialsRejected: {
		title: "That username or password didn't work",
		description: "Check both and try again.",
	},
	CredentialsUnavailable: {
		title: "This Space needs its owner",
		description: "An owner has to reconnect the Space before this works again.",
	},
	GifsNotConfigured: FEATURE_UNAVAILABLE("GIF search"),
	IdentityMismatch: {
		title: "That's a different account",
		description: "Sign in with the account you want to use for this Space.",
	},
	ImageTooLarge: {
		title: "That image is too big",
		description: "Icons can be up to 1 MB and banners up to 4 MB.",
	},
	InsufficientPermissions: NO_PERMISSION,
	InvalidDelegationToken: {
		title: "Your settings didn't sync yet",
		description: "Colibri will try again on its own. Nothing is lost.",
	},
	InvalidFrame: CONNECTION,
	InvitationNotFound: {
		title: "This invite doesn't work anymore",
		description: "It may have expired or run out of uses. Ask for a new one.",
	},
	LabelNotFound: { title: "That was already undone" },
	MemberNotFound: { title: "They're not in this Space anymore" },
	MessageNotFound: {
		title: "That message isn't there anymore",
		description: "It may have been deleted.",
	},
	NotAMember: {
		title: "You're not in this Space yet",
		description: "Join it to see what's inside.",
	},
	NotAuthorized: {
		title: "Your settings didn't sync yet",
		description: "Colibri will try again on its own. Nothing is lost.",
	},
	NotBanned: { title: "They aren't banned" },
	NotFetchable: {
		title: "We couldn't show a preview for that link",
		description: "The link still works if you open it.",
	},
	NotInVoice: { title: "They've already left the call" },
	NotJoined: {
		title: "You're not in that call",
		description: "Join the voice channel and try again.",
	},
	NotVoiceChannel: { title: "That's not a voice channel" },
	PushNotConfigured: FEATURE_UNAVAILABLE("Notifications"),
	RoleHierarchy: {
		title: "That role is above yours",
		description: "You can only manage roles below your own.",
	},
	RoleNotFound: {
		title: "That role isn't there anymore",
		description: "It may have been deleted.",
	},
	RoleProtected: {
		title: "The owner role can't be changed",
	},
	SoleOwner: {
		title: "You're the only owner",
		description: "Make someone else an owner before you leave.",
	},
	SoleOwnerOfCommunity: {
		title: "You still own a Space",
		description: "Hand it over or delete it before deleting your account.",
	},
	SpaceNotFound: {
		title: "That isn't there anymore",
		description: "It may have been deleted, or you no longer have access.",
	},
	SpacesUnsupported: {
		title: "Your account can't host a Space yet",
		description:
			"Your account provider doesn't support Spaces so far. Joining other Spaces still works.",
	},
	UnsupportedImage: {
		title: "That image type isn't supported",
		description: "Use a JPEG, PNG, GIF or WebP image.",
	},
	VoiceUnavailable: FEATURE_UNAVAILABLE("Voice"),
	AuthRequired: SIGN_IN_AGAIN,
	Forbidden: NO_PERMISSION,
	InvalidRequest: {
		title: "Something in there doesn't look right",
		description: "Check what you entered and try again.",
	},
	InvalidState: { title: "That option isn't available" },
	NotFound: {
		title: "That isn't there anymore",
		description: "It may have been deleted or moved.",
	},
	NotEnabled: FEATURE_UNAVAILABLE("This feature"),
	RateLimited: {
		title: "Slow down a little",
		description: "Wait a few seconds, then try again.",
	},
	PdsUnavailable: {
		title: "Changes can't be saved right now",
		description:
			"Your account provider isn't responding. You can still read, and Colibri retries for you.",
	},
	UpstreamFailure: COLIBRI_HICCUP,
	InternalError: COLIBRI_HICCUP,

	Offline: {
		title: "You're offline",
		description: "Colibri picks up where you left off once you're back.",
	},
	Timeout: CONNECTION,
	Unreachable: CONNECTION,
	NetworkFailed: CONNECTION,

	InvalidToken: SIGN_IN_AGAIN,
	ExpiredToken: SIGN_IN_AGAIN,
	ScopesMissing: {
		title: "Colibri needs a quick approval",
		description: "Sign in once more and allow access so everything works.",
	},
	StorageStalled: {
		title: "Colibri got stuck",
		description: "Close and reopen the app to fix it.",
	},
	HandleNotFound: {
		title: "We couldn't find that username",
		description: "Check it for typos. It usually looks like name.bsky.social.",
	},
	OAuthDenied: {
		title: "Sign-in was cancelled",
		description: "Nothing was shared. Try again whenever you're ready.",
	},
	OAuthInteractionRequired: {
		title: "Finish signing in with your account provider",
		description: "Sign in there first, then come back and try again.",
	},
	OAuthGrantExpired: {
		title: "That sign-in took too long",
		description: "Start again and it'll work.",
	},
	OAuthConfigRejected: {
		title: "Sign-in isn't working right now",
		description: "This is on our end. Try again in a little while.",
	},
	OAuthProviderUnavailable: {
		title: "Your account provider isn't responding",
		description: "Try signing in again in a few minutes.",
	},
	SignInFailed: {
		title: "Sign-in didn't work",
		description: "Give it another try.",
	},

	NativeCancelled: { title: "Cancelled" },
	NativeUnavailable: { title: "This doesn't work on this device" },
	NativeFailed: TRY_AGAIN,

	TooManyFiles: {
		title: "That's too many files",
		description: "You can attach up to 10 at once.",
	},
	FileTooLarge: {
		title: "That file is too big",
		description: "Files can be up to 50 MB.",
	},
	FileTooSmall: {
		title: "That file is empty",
		description: "Pick a different one.",
	},
	UnsupportedFileType: { title: "That file type isn't supported" },
	UploadFailed: {
		title: "The upload didn't finish",
		description: "Check your internet connection and try again.",
	},
	DevicePermissionDenied: {
		title: "Colibri can't use that yet",
		description: "Allow access in your device settings, then try again.",
	},
	DeviceUnavailable: {
		title: "That device isn't available",
		description: "Make sure it's plugged in and no other app is using it.",
	},

	VoiceJoinFailed: {
		title: "Couldn't join the call",
		description: "Check your internet connection and try again.",
	},
	VoiceConnectionLost: {
		title: "You lost the call",
		description: "Colibri is reconnecting you.",
	},
	VoiceStreamFailed: {
		title: "Someone's audio or video isn't coming through",
		description: "Leaving and rejoining the call usually fixes it.",
	},

	CacheUnavailable: {
		title: "Colibri can't save things on this device",
		description: "Everything still works, but loading may be slower.",
	},
	PreferencesUnavailable: {
		title: "Your settings couldn't be saved",
		description: "Private browsing can block this. Try a normal window.",
	},
	DraftUnavailable: {
		title: "Your draft couldn't be saved",
		description: "Copy your text somewhere safe before leaving.",
	},

	MalformedResponse: COLIBRI_HICCUP,
	Unexpected: TRY_AGAIN,
};

export const { copyForCode, describeError } = createErrorCopy(
	APP_ERROR_COPY,
	TRY_AGAIN,
);

export type VoiceNoticeKey =
	| VoiceEndReason
	| VoiceNotice
	| "serverMuted"
	| "serverDeafened";

export const VOICE_NOTICE_COPY: Record<VoiceNoticeKey, ErrorCopy> = {
	moderator: {
		title: "A moderator removed you from the call",
		description: "You can join again if they allow it.",
	},
	superseded: {
		title: "You joined this call on another device",
		description: "Only one device can be in a call at a time.",
	},
	channelGone: {
		title: "That voice channel isn't there anymore",
		description: "It may have been deleted.",
	},
	forbidden: {
		title: "You can't be in this call anymore",
		description: "Your role in this Space no longer allows it.",
	},
	closed: {
		title: "The call ended",
		description: "Join again whenever you're ready.",
	},
	lost: {
		title: "You lost the call",
		description: "Check your internet connection, then join again.",
	},
	unsupported: {
		title: "Calls don't work on this device yet",
		description: "Try Colibri on another device or browser.",
	},
	failed: {
		title: "Couldn't join the call",
		description: "Check your internet connection and try again.",
	},
	noMicrophone: {
		title: "You joined without a microphone",
		description:
			"Others can't hear you. Allow Colibri to use your microphone, then join again.",
	},
	streamFailed: {
		title: "Someone's audio or video isn't coming through",
		description: "Leaving and rejoining the call usually fixes it.",
	},
	cameraFailed: {
		title: "Your camera didn't turn on",
		description: "Make sure no other app is using it, then try again.",
	},
	serverMuted: {
		title: "A moderator muted you",
		description: "You can talk again once they unmute you.",
	},
	serverDeafened: {
		title: "A moderator deafened you",
		description: "You can hear the call again once they undeafen you.",
	},
};

export const SPACE_ORDER_NOT_SAVED: ErrorCopy = {
	title: "Your new Space order wasn't saved",
	description:
		"Your Spaces are back in their old order. Check your internet connection and try again.",
};
