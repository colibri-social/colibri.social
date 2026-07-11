import type { APIRoute } from "astro";
import { nativeRedirectUri } from "@/utils/atproto/native-scheme";
import { buildScopes } from "@/utils/atproto/scopes";

/**
 * Per-AppView OAuth client metadata for the NATIVE app, the native counterpart
 * of `c/[appview]/oauth-client-metadata.json.ts`.
 */

/** Reject anything that isn't a plausible bare hostname before minting a DID */
const isLikelyHostname = (host: string): boolean =>
	/^[a-zA-Z0-9.-]+$/.test(host) &&
	host.includes(".") &&
	!host.startsWith(".") &&
	!host.endsWith(".");

export const GET: APIRoute = ({ params }) => {
	const appview = params.appview;

	if (!appview || !isLikelyHostname(appview)) {
		return new Response("Invalid AppView host", { status: 404 });
	}

	const metadata = {
		client_id: `${import.meta.env.SITE}/c/${appview}/oauth-client-metadata-native.json`,
		client_name: "Colibri Social",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [nativeRedirectUri()],
		scope: buildScopes(`did:web:${appview}`).join(" "),
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		application_type: "native",
		token_endpoint_auth_method: "none",
		dpop_bound_access_tokens: true,
	};

	return new Response(JSON.stringify(metadata), {
		status: 200,
		statusText: "OK",
		headers: new Headers({
			"content-type": "application/json",
		}),
	});
};
