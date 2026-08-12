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
	TooManySubscribers: {
		title: "This server is at capacity.",
		description: "Try again in a few minutes.",
	},
	NotAnImage: {
		title: "That link isn't an image.",
	},
	SfuError: {
		title: "The voice server had a problem.",
		description: "Try rejoining the channel.",
	},
	PdsUnavailable: {
		title: "Your data server isn't reachable.",
		description: "Reads still work, but changes can't be saved right now.",
	},
	CommunityCredentialsUnrecoverable: {
		title: "This community can't be edited right now.",
		description: "Its data server access needs to be repaired by an admin.",
	},
	NotCommunityHub: {
		title: "This community is managed somewhere else.",
		description: "Reload to pick up where it moved to, then try again.",
	},
	AppViewNotAuthorized: {
		title: "Turn on presence sharing to moderate here.",
		description:
			"This community is hosted on another AppView, which needs to know yours is allowed to act for you.",
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
