import type { APIRoute } from "astro";
import { nativeRedirectUri } from "@/utils/atproto/native-scheme";
import { scopes } from "@/utils/atproto/scopes";

/**
 * OAuth client metadata for the NATIVE app (Tauri desktop / mobile), pinned to
 * the default AppView. Differs from the web document (see
 * `oauth-client-metadata.json.ts`) in two ways: `application_type` is `native`,
 * and the redirect is a custom URI scheme handled by the app's deep-link plugin
 * rather than an in-origin URL
 */
export const GET: APIRoute = () => {
	const metadata = {
		client_id: `${import.meta.env.SITE}/oauth-client-metadata-native.json`,
		client_name: "Colibri Social",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [nativeRedirectUri()],
		scope: scopes.join(" "),
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
