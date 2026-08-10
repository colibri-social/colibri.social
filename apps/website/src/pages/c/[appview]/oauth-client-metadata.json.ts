import type { APIRoute } from "astro";
import { buildScopes } from "@/utils/atproto/scopes";

/**
 * Serves a per-AppView OAuth client metadata document. The conventional
 * document at `/oauth-client-metadata.json` pins its scope to the default
 * AppView; this route mints an equivalent document for any other AppView, with
 * `scope` pinned to that AppView's `did:web`.
 *
 * This is how a user can authorise against a self-hosted / third-party AppView
 * in production: the authorization server requires the requested scope to be a
 * subset of the client metadata's scope, and `include:` permission sets can't
 * use a wildcard `aud`, so each AppView needs its own document. Hosting them all
 * under our own origin is what makes the redirect trustworthy — the `client_id`
 * origin has no required relationship to the AppView domain.
 *
 * `params.appview` is the AppView host (e.g. `api.example.com`); the client
 * builds the matching `client_id` in `makeClientId` (packages/client auth.ts).
 */

/** Reject anything that isn't a plausible bare hostname before minting a DID. */
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
		// Built from SITE (not the request URL) so it's the canonical public
		// origin and matches the `client_id` the client requested, even behind a
		// proxy. The authorization server checks `metadata.client_id === client_id`.
		client_id: `${import.meta.env.SITE}/c/${appview}/oauth-client-metadata.json`,
		client_name: "Colibri Social",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [`${import.meta.env.SITE}/app/login`],
		scope: buildScopes(`did:web:${appview}`).join(" "),
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
