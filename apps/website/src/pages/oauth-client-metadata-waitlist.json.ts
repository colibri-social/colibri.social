import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
	const metadata = {
		client_id: `${import.meta.env.SITE}/oauth-client-metadata-waitlist.json`,
		client_name: "Colibri Waitlist",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [`${import.meta.env.SITE}/app/waitlist`],
		scope: "atproto transition:email",
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
