import { classifyThrown } from "./classify";
import type { ColibriErrorCode } from "./codes";
import { isColibriError } from "./error";

export interface ErrorCopy {
	title: string;
	description?: string;
}

export const FALLBACK_COPY: ErrorCopy = {
	title: "Something went wrong.",
	description: "Please try again.",
};

const CATALOG: Record<ColibriErrorCode, ErrorCopy> = {
	ActorNotFound: {
		title: "We couldn't find that account.",
		description: "Check the handle and try again.",
	},
	AlreadyBanned: {
		title: "They're already banned.",
	},
	AlreadyExists: {
		title: "That name is taken.",
		description: "Pick a different one.",
	},
	AlreadyMember: {
		title: "They're already a member.",
	},
	ApplicationNotFound: {
		title: "That request is no longer pending.",
		description: "Someone may have already handled it.",
	},
	Banned: {
		title: "You can't join this community.",
		description: "You've been banned from it.",
	},
	BlobNotFound: {
		title: "That file is missing.",
		description: "It may have been deleted.",
	},
	CategoryNotFound: {
		title: "That category is gone.",
	},
	ChannelNotFound: {
		title: "That channel is gone.",
		description:
			"It may have been deleted, or you may no longer be able to see it.",
	},
	CommunityNotFound: {
		title: "That community is gone.",
		description: "It may have been deleted, or you may not be able to see it.",
	},
	CredentialsRejected: {
		title: "Those credentials didn't work.",
		description: "Check the identifier and password and try again.",
	},
	CredentialsUnavailable: {
		title: "This community needs reconnecting.",
		description:
			"An owner has to give Colibri its credentials again before this will work.",
	},
	GifsNotConfigured: {
		title: "GIFs aren't available here.",
		description: "This AppView has no GIF provider set up.",
	},
	IdentityMismatch: {
		title: "Those credentials belong to a different account.",
		description: "Sign in as the account you're adopting.",
	},
	ImageTooLarge: {
		title: "That image is too big.",
		description: "Icons can be up to 1 MB and banners up to 4 MB.",
	},
	InsufficientPermissions: {
		title: "You don't have permission to do that.",
		description: "Ask a moderator if you think you should.",
	},
	InvalidDelegationToken: {
		title: "We couldn't share your preferences.",
		description: "Colibri will try again shortly.",
	},
	InvalidFrame: {
		title: "The connection got confused.",
		description: "Reconnecting should sort it out.",
	},
	InvitationNotFound: {
		title: "That invite doesn't work.",
		description: "It may have expired or been used up.",
	},
	LabelNotFound: {
		title: "That was already undone.",
	},
	MemberNotFound: {
		title: "They're not in this community.",
	},
	MessageNotFound: {
		title: "That message is gone.",
	},
	NotAMember: {
		title: "You're not in this community.",
		description: "Join it to see what's inside.",
	},
	NotAuthorized: {
		title: "We couldn't share your preferences.",
		description: "Colibri will try again shortly.",
	},
	NotBanned: {
		title: "They aren't banned.",
	},
	NotFetchable: {
		title: "We couldn't load that link.",
		description: "The site didn't respond, or refused us.",
	},
	NotInVoice: {
		title: "They've left the call.",
	},
	NotJoined: {
		title: "You're not in that call.",
		description: "Join the channel and try again.",
	},
	NotVoiceChannel: {
		title: "That isn't a voice channel.",
	},
	PushNotConfigured: {
		title: "Push notifications aren't available here.",
		description: "This AppView has no push keys set up.",
	},
	RoleHierarchy: {
		title: "That role outranks yours.",
		description: "You can only manage roles below your own.",
	},
	RoleNotFound: {
		title: "That role is gone.",
	},
	RoleProtected: {
		title: "That role can't be changed.",
		description: "The owner role is protected.",
	},
	SoleOwner: {
		title: "You're the last owner.",
		description: "Give someone else the owner role before you leave.",
	},
	SoleOwnerOfCommunity: {
		title: "You still own a community.",
		description: "Transfer or delete it before deleting your account.",
	},
	SpaceNotFound: {
		title: "That's no longer available.",
	},
	SpacesUnsupported: {
		title: "That server can't host a community.",
		description: "Its PDS doesn't support permissioned spaces yet.",
	},
	UnsupportedImage: {
		title: "That file isn't a supported image.",
		description: "Use a JPEG, PNG, GIF or WebP.",
	},
	VoiceUnavailable: {
		title: "Voice isn't available here.",
		description: "This AppView has no voice server running.",
	},
	AuthRequired: {
		title: "You need to sign in again.",
		description: "Your session is no longer valid.",
	},
	Forbidden: {
		title: "You don't have permission to do that.",
		description: "Ask a moderator if you think you should.",
	},
	InvalidRequest: {
		title: "That didn't look right.",
		description: "Check the details and try again.",
	},
	InvalidState: {
		title: "That status isn't available.",
	},
	NotFound: {
		title: "That doesn't exist anymore.",
		description: "It may have been deleted or moved.",
	},
	NotEnabled: {
		title: "That feature is turned off here.",
	},
	RateLimited: {
		title: "You're going a bit fast.",
		description: "Wait a moment and try again.",
	},
	PdsUnavailable: {
		title: "Your data server isn't reachable.",
		description: "Reads still work, but changes can't be saved right now.",
	},
	UpstreamFailure: {
		title: "A service we depend on is having trouble.",
		description: "This usually clears up on its own.",
	},
	InternalError: {
		title: "The server ran into a problem.",
		description: "We've been notified and are looking into it.",
	},

	Offline: {
		title: "You're offline.",
		description: "We'll finish this once you're back online.",
	},
	Timeout: {
		title: "That took too long.",
		description: "Check your connection and try again.",
	},
	Unreachable: {
		title: "We couldn't reach the server.",
		description: "Check your connection and try again.",
	},
	NetworkFailed: {
		title: "The connection dropped.",
		description: "Check your connection and try again.",
	},

	InvalidToken: {
		title: "You need to sign in again.",
		description: "Your session is no longer valid.",
	},
	ExpiredToken: {
		title: "Your session expired.",
		description: "Sign in again to pick up where you left off.",
	},
	ScopesMissing: {
		title: "Colibri needs more permissions.",
		description: "Grant the missing permissions to continue.",
	},
	StorageStalled: {
		title: "This device's local storage stopped responding.",
		description: "Restarting the app usually clears it.",
	},
	HandleNotFound: {
		title: "We couldn't find that handle.",
		description: "Check the spelling and try again.",
	},
	OAuthDenied: {
		title: "You declined the sign-in request.",
		description: "Nothing was shared. You can try again whenever you like.",
	},
	OAuthInteractionRequired: {
		title: "Your provider needs you to sign in there first.",
		description: "Sign in with your provider, then start again here.",
	},
	OAuthGrantExpired: {
		title: "That sign-in attempt expired.",
		description: "Start again to get a fresh link.",
	},
	OAuthConfigRejected: {
		title: "Your provider wouldn't accept our sign-in request.",
		description: "This is a problem on our side and we've been notified.",
	},
	OAuthProviderUnavailable: {
		title: "Your provider is temporarily unavailable.",
		description: "Try again shortly.",
	},
	SignInFailed: {
		title: "Sign-in failed.",
		description: "Please try again.",
	},

	NativeCancelled: {
		title: "That was cancelled.",
	},
	NativeUnavailable: {
		title: "That isn't available on this device.",
	},
	NativeFailed: {
		title: "The app couldn't complete that.",
		description: "Please try again.",
	},

	TooManyFiles: {
		title: "That's too many files.",
	},
	FileTooLarge: {
		title: "That file is too large.",
	},
	FileTooSmall: {
		title: "That file is too small.",
	},
	UnsupportedFileType: {
		title: "That file type isn't supported.",
	},
	UploadFailed: {
		title: "The upload failed.",
		description: "Check your connection and try again.",
	},
	DevicePermissionDenied: {
		title: "Colibri doesn't have access to that device.",
		description: "Grant access in your system settings.",
	},
	DeviceUnavailable: {
		title: "That device isn't available.",
		description: "Check that nothing else is using it.",
	},

	VoiceJoinFailed: {
		title: "Couldn't join the voice channel.",
		description: "Check your connection and try again.",
	},
	VoiceConnectionLost: {
		title: "The voice connection dropped.",
		description: "Reconnecting automatically.",
	},
	VoiceStreamFailed: {
		title: "Someone's audio or video couldn't be played.",
		description: "Try rejoining the channel.",
	},

	CacheUnavailable: {
		title: "Offline storage isn't working.",
		description:
			"The app still works, but it will be slower and won't work offline.",
	},
	PreferencesUnavailable: {
		title: "Your settings couldn't be saved.",
		description: "Private browsing can prevent saving settings.",
	},
	DraftUnavailable: {
		title: "Your draft couldn't be saved.",
	},

	MalformedResponse: {
		title: "The server sent something we couldn't read.",
		description: "We've been notified and are looking into it.",
	},
	Unexpected: FALLBACK_COPY,
};

export const copyForCode = (code: ColibriErrorCode): ErrorCopy =>
	CATALOG[code] ?? FALLBACK_COPY;

export const describeError = (err: unknown): ErrorCopy => {
	const classified = isColibriError(err) ? err : classifyThrown(err);
	const base = copyForCode(classified.code);

	const fieldMessage = classified.fields[0]?.message;
	if (fieldMessage) {
		return { title: base.title, description: fieldMessage };
	}

	return base;
};

export const codeForFileRejection = (rejection: string): ColibriErrorCode => {
	switch (rejection) {
		case "TOO_MANY_FILES":
			return "TooManyFiles";
		case "FILE_TOO_LARGE":
			return "FileTooLarge";
		case "FILE_TOO_SMALL":
			return "FileTooSmall";
		case "FILE_INVALID_TYPE":
			return "UnsupportedFileType";
		default:
			return "Unexpected";
	}
};
