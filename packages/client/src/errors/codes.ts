import {
	APPVIEW_CODE_DESCRIPTIONS,
	type AppViewErrorCode,
	isAppViewErrorCode,
} from "./appview-codes";

export type ServerErrorCode = "InternalError";

export type TransportErrorCode =
	| "Offline"
	| "Timeout"
	| "Unreachable"
	| "NetworkFailed";

export type SessionErrorCode =
	| "InvalidToken"
	| "ExpiredToken"
	| "ScopesMissing"
	| "StorageStalled"
	| "HandleNotFound"
	| "OAuthDenied"
	| "OAuthInteractionRequired"
	| "OAuthGrantExpired"
	| "OAuthConfigRejected"
	| "OAuthProviderUnavailable"
	| "SignInFailed";

export type NativeErrorCode =
	| "NativeCancelled"
	| "NativeUnavailable"
	| "NativeFailed";

export type MediaErrorCode =
	| "TooManyFiles"
	| "FileTooLarge"
	| "FileTooSmall"
	| "UnsupportedFileType"
	| "UploadFailed"
	| "DevicePermissionDenied"
	| "DeviceUnavailable";

export type VoiceErrorCode =
	| "VoiceJoinFailed"
	| "VoiceConnectionLost"
	| "VoiceStreamFailed";

export type StorageErrorCode =
	| "CacheUnavailable"
	| "PreferencesUnavailable"
	| "DraftUnavailable";

export type ClientErrorCode = "MalformedResponse" | "Unexpected";

export type ColibriErrorCode =
	| AppViewErrorCode
	| ServerErrorCode
	| TransportErrorCode
	| SessionErrorCode
	| NativeErrorCode
	| MediaErrorCode
	| VoiceErrorCode
	| StorageErrorCode
	| ClientErrorCode;

export type ErrorDomain =
	| "appview"
	| "transport"
	| "session"
	| "native"
	| "media"
	| "voice"
	| "storage"
	| "client";

const DOMAIN_BY_CODE: Partial<Record<ColibriErrorCode, ErrorDomain>> = {
	InternalError: "appview",

	Offline: "transport",
	Timeout: "transport",
	Unreachable: "transport",
	NetworkFailed: "transport",

	InvalidToken: "session",
	ExpiredToken: "session",
	ScopesMissing: "session",
	StorageStalled: "session",
	HandleNotFound: "session",
	OAuthDenied: "session",
	OAuthInteractionRequired: "session",
	OAuthGrantExpired: "session",
	OAuthConfigRejected: "session",
	OAuthProviderUnavailable: "session",
	SignInFailed: "session",

	NativeCancelled: "native",
	NativeUnavailable: "native",
	NativeFailed: "native",

	TooManyFiles: "media",
	FileTooLarge: "media",
	FileTooSmall: "media",
	UnsupportedFileType: "media",
	UploadFailed: "media",
	DevicePermissionDenied: "media",
	DeviceUnavailable: "media",

	VoiceJoinFailed: "voice",
	VoiceConnectionLost: "voice",
	VoiceStreamFailed: "voice",

	CacheUnavailable: "storage",
	PreferencesUnavailable: "storage",
	DraftUnavailable: "storage",

	MalformedResponse: "client",
	Unexpected: "client",
};

const NON_APPVIEW_CODES = Object.keys(
	DOMAIN_BY_CODE,
) as Array<ColibriErrorCode>;

export const ALL_ERROR_CODES: ReadonlyArray<ColibriErrorCode> = [
	...(Object.keys(APPVIEW_CODE_DESCRIPTIONS) as Array<ColibriErrorCode>),
	...NON_APPVIEW_CODES.filter((code) => !(code in APPVIEW_CODE_DESCRIPTIONS)),
];

export const domainOf = (code: ColibriErrorCode): ErrorDomain =>
	DOMAIN_BY_CODE[code] ?? (isAppViewErrorCode(code) ? "appview" : "client");

const RETRYABLE_CODES = new Set<ColibriErrorCode>([
	"Offline",
	"Timeout",
	"Unreachable",
	"NetworkFailed",
	"RateLimited",
	"UpstreamFailure",
	"PdsUnavailable",
	"InternalError",
	"TooManySubscribers",
	"SfuError",
	"VoiceConnectionLost",
	"UploadFailed",
]);

export const isRetryableCode = (code: ColibriErrorCode): boolean =>
	RETRYABLE_CODES.has(code);

export const GONE_CODES: ReadonlyArray<ColibriErrorCode> = [
	"NotFound",
	"Forbidden",
];

export const isGoneCode = (code: ColibriErrorCode): boolean =>
	GONE_CODES.includes(code);

const PDS_SESSION_CODES = new Set<string>(["ExpiredToken", "InvalidToken"]);

export const isPdsSessionErrorCode = (
	value: string,
): value is ColibriErrorCode => PDS_SESSION_CODES.has(value);

const SESSION_RECOVERY_CODES = new Set<ColibriErrorCode>([
	"InvalidToken",
	"ExpiredToken",
	"AuthRequired",
	"ScopesMissing",
]);

export const needsReauthentication = (code: ColibriErrorCode): boolean =>
	SESSION_RECOVERY_CODES.has(code);

export {
	APPVIEW_CODE_DESCRIPTIONS,
	APPVIEW_METHOD_ERRORS,
	isAppViewErrorCode,
} from "./appview-codes";
export type { AppViewErrorCode };
