import type { APIRoute } from "astro";
import { scopes } from "@/utils/atproto/scopes";

/**
 * Serves the OAuth client metadata document.
 */
export const GET: APIRoute = () => {
	const metadata = {
		client_id: `${import.meta.env.SITE}/oauth-client-metadata.json`,
		client_name: "Colibri Chat",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [`${import.meta.env.SITE}/app/login`],
		scope: scopes.join(" "),
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		application_type: "web",
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
