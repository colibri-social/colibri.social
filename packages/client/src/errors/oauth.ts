import type { ColibriErrorCode } from "./codes";
import { ColibriError, isColibriError } from "./error";

const CODE_BY_OAUTH_ERROR: Record<string, ColibriErrorCode> = {
	access_denied: "OAuthDenied",

	login_required: "OAuthInteractionRequired",
	consent_required: "OAuthInteractionRequired",
	interaction_required: "OAuthInteractionRequired",
	account_selection_required: "OAuthInteractionRequired",

	invalid_grant: "OAuthGrantExpired",

	invalid_request: "OAuthConfigRejected",
	invalid_client: "OAuthConfigRejected",
	invalid_client_metadata: "OAuthConfigRejected",
	unauthorized_client: "OAuthConfigRejected",
	unsupported_response_type: "OAuthConfigRejected",
	unsupported_grant_type: "OAuthConfigRejected",
	invalid_scope: "OAuthConfigRejected",
	invalid_request_uri: "OAuthConfigRejected",
	invalid_request_object: "OAuthConfigRejected",
	request_not_supported: "OAuthConfigRejected",
	request_uri_not_supported: "OAuthConfigRejected",
	registration_not_supported: "OAuthConfigRejected",

	server_error: "OAuthProviderUnavailable",
	temporarily_unavailable: "OAuthProviderUnavailable",

	slow_down: "RateLimited",
};

export const codeForOAuthError = (
	code: string | null | undefined,
): ColibriErrorCode => {
	if (!code) return "SignInFailed";
	return CODE_BY_OAUTH_ERROR[code] ?? "SignInFailed";
};

interface OAuthFailure {
	code?: string;
	description?: string;
	status?: number;
	issuer?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

export const readOAuthParams = (params: URLSearchParams): OAuthFailure => ({
	code: asString(params.get("error")),
	description: asString(params.get("error_description")),
	issuer: asString(params.get("iss")),
});

const fromCallbackError = (err: unknown): OAuthFailure | undefined => {
	const params = asRecord(err)?.params;
	return params instanceof URLSearchParams
		? readOAuthParams(params)
		: undefined;
};

const fromResponseError = (err: unknown): OAuthFailure | undefined => {
	const record = asRecord(err);
	const code = asString(record?.error);
	if (!code) return undefined;
	const status = record?.status;
	return {
		code,
		description: asString(record?.errorDescription),
		status: typeof status === "number" ? status : undefined,
	};
};

export const readOAuthFailure = (err: unknown): OAuthFailure | undefined =>
	fromCallbackError(err) ?? fromResponseError(err);

const asColibriError = (failure: OAuthFailure, cause?: unknown): ColibriError =>
	new ColibriError({
		code: codeForOAuthError(failure.code),
		status: failure.status,
		serverMessage: failure.description,
		cause,
		context: {
			...(failure.code ? { oauthError: failure.code } : {}),
			...(failure.issuer ? { issuer: failure.issuer } : {}),
		},
	});

export const classifyOAuthParams = (params: URLSearchParams): ColibriError =>
	asColibriError(readOAuthParams(params));

export const classifyOAuthError = (err: unknown): ColibriError | undefined => {
	if (isColibriError(err)) return err;
	const failure = readOAuthFailure(err);
	return failure ? asColibriError(failure, err) : undefined;
};

export const isSignInDenial = (err: unknown): boolean =>
	isColibriError(err) && err.code === "OAuthDenied";
