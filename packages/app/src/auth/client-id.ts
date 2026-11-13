import type { BrowserOAuthClientOptions } from "@atproto/oauth-client-browser";
import { buildScopes } from "@colibri-social/lib";
import { appViewDid, appViewUrl, isDefaultAppView } from "./appview";
import { SIGN_IN_PATH } from "./callback";

export const NATIVE_CLIENT_ORIGIN = "https://spaces.colibri.social";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type ClientLocation = Pick<Location, "hostname" | "host" | "port">;

export type ClientMetadata = NonNullable<
	BrowserOAuthClientOptions["clientMetadata"]
>;

type RedirectUri = ClientMetadata["redirect_uris"][number];

type ClientInput = {
	native: boolean;
	location: ClientLocation;
	appView?: string;
};

const isLoopback = (location: ClientLocation): boolean =>
	LOOPBACK_HOSTS.has(location.hostname);

export const NATIVE_REDIRECT_URI = `${new URL(NATIVE_CLIENT_ORIGIN).hostname
	.split(".")
	.reverse()
	.join(".")}:/oauth/callback` as RedirectUri;

export const makeClientId = (input: ClientInput): string => {
	const appView = input.appView ?? appViewUrl();
	const appViewHost = new URL(appView).host;
	const pinned = isDefaultAppView(appView);

	if (input.native) {
		return pinned
			? `${NATIVE_CLIENT_ORIGIN}/oauth-client-metadata-native.json`
			: `${NATIVE_CLIENT_ORIGIN}/c/${appViewHost}/oauth-client-metadata-native.json`;
	}

	if (isLoopback(input.location)) {
		return `http://localhost?${new URLSearchParams({
			scope: buildScopes(appViewDid(appView)).join(" "),
			redirect_uri: `http://127.0.0.1:${input.location.port}${SIGN_IN_PATH}`,
		})}`;
	}

	return pinned
		? `https://${input.location.host}/oauth-client-metadata.json`
		: `https://${input.location.host}/c/${appViewHost}/oauth-client-metadata.json`;
};

export const makeClientMetadata = (
	input: ClientInput,
): ClientMetadata | undefined => {
	const clientId = makeClientId(input);

	if (!clientId.startsWith("https:")) return undefined;

	const origin = new URL(clientId).origin;
	const appView = input.appView ?? appViewUrl();
	const redirectUri = input.native
		? NATIVE_REDIRECT_URI
		: (`${origin}${SIGN_IN_PATH}` as RedirectUri);

	return {
		client_id: clientId,
		client_name: "Colibri Social",
		client_uri: origin,
		redirect_uris: [redirectUri],
		scope: buildScopes(appViewDid(appView)).join(" "),
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		application_type: input.native ? "native" : "web",
		token_endpoint_auth_method: "none",
		dpop_bound_access_tokens: true,
	};
};
