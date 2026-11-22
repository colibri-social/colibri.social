import { buildLegacyScopes, legacyScopes } from "./legacy-scopes";

type LegacyClient = {
	clientIdPath: string;
	clientName: string;
	redirectUri: string;
	scope: string;
	applicationType: "web" | "native";
};

const LEGACY_SITE = "https://colibri.social";

const LEGACY_NATIVE_REDIRECT_URI = `${new URL(LEGACY_SITE).hostname
	.split(".")
	.reverse()
	.join(".")}:/oauth/callback`;

const LEGACY_WEB_REDIRECT_URI = `${LEGACY_SITE}/app/login`;

const APPVIEW_ROUTE = /^\/c\/([^/]+)\/oauth-client-metadata(-native)?\.json$/;

const defaultClient = (
	clientIdPath: string,
	redirectUri: string,
	applicationType: LegacyClient["applicationType"],
): LegacyClient => {
	return {
		clientIdPath,
		clientName: "Colibri Social",
		redirectUri,
		scope: legacyScopes.join(" "),
		applicationType,
	};
};

const STATIC_CLIENTS: Record<string, LegacyClient> = {
	"/oauth-client-metadata.json": defaultClient(
		"/oauth-client-metadata.json",
		LEGACY_WEB_REDIRECT_URI,
		"web",
	),
	"/oauth-client-metadata-native.json": defaultClient(
		"/oauth-client-metadata-native.json",
		LEGACY_NATIVE_REDIRECT_URI,
		"native",
	),
	"/oauth-client-metadata-3ds.json": defaultClient(
		"/oauth-client-metadata-3ds.json",
		`${LEGACY_SITE}/3ds/qr`,
		"native",
	),
	"/oauth-client-metadata-waitlist.json": {
		clientIdPath: "/oauth-client-metadata-waitlist.json",
		clientName: "Colibri Waitlist",
		redirectUri: `${LEGACY_SITE}/app/waitlist`,
		scope: "atproto transition:email",
		applicationType: "web",
	},
};

const isLikelyHostname = (host: string) => {
	return (
		/^[a-zA-Z0-9.-]+$/.test(host) &&
		host.includes(".") &&
		!host.startsWith(".") &&
		!host.endsWith(".")
	);
};

const decodeSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

const metadataResponse = (client: LegacyClient) => {
	const metadata = {
		client_id: `${LEGACY_SITE}${client.clientIdPath}`,
		client_name: client.clientName,
		client_uri: LEGACY_SITE,
		logo_uri: `${LEGACY_SITE}/logo.png`,
		tos_uri: `${LEGACY_SITE}/tos`,
		policy_uri: `${LEGACY_SITE}/policy`,
		redirect_uris: [client.redirectUri],
		scope: client.scope,
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		application_type: client.applicationType,
		token_endpoint_auth_method: "none",
		dpop_bound_access_tokens: true,
	};

	return new Response(JSON.stringify(metadata), {
		status: 200,
		statusText: "OK",
		headers: new Headers({
			"content-type": "application/json",
			"access-control-allow-origin": "*",
		}),
	});
};

const appViewResponse = (segment: string, native: boolean) => {
	const appview = decodeSegment(segment);

	if (!appview || !isLikelyHostname(appview)) {
		return new Response("Invalid AppView host", { status: 404 });
	}

	const file = native
		? "oauth-client-metadata-native.json"
		: "oauth-client-metadata.json";

	return metadataResponse({
		clientIdPath: `/c/${appview}/${file}`,
		clientName: "Colibri Social",
		redirectUri: native ? LEGACY_NATIVE_REDIRECT_URI : LEGACY_WEB_REDIRECT_URI,
		scope: buildLegacyScopes(`did:web:${appview}`).join(" "),
		applicationType: native ? "native" : "web",
	});
};

export const legacyOAuthResponse = (pathname: string) => {
	const staticClient = STATIC_CLIENTS[pathname];

	if (staticClient) return metadataResponse(staticClient);

	const appViewMatch = APPVIEW_ROUTE.exec(pathname);

	if (!appViewMatch) return undefined;

	return appViewResponse(appViewMatch[1], appViewMatch[2] !== undefined);
};
