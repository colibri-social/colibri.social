import { PRIVATE_KEY_1, PRIVATE_KEY_2 } from "astro:env/server";
import { JoseKey } from "@atproto/jwk-jose";
import {
	NodeOAuthClient,
	type NodeSavedSession,
	type NodeSavedState,
} from "@atproto/oauth-client-node";
import { getRedisClient } from "../redis";

export const scopes = [
	"atproto",
	"blob:*/*",
	"rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app#bsky_appview",
	"repo:social.colibri.actor.data?action=create&action=update&action=delete",
	"repo:social.colibri.community?action=create&action=update&action=delete",
	"repo:social.colibri.category?action=create&action=update&action=delete",
	"repo:social.colibri.channel?action=create&action=update&action=delete",
	"repo:social.colibri.message?action=create&action=update&action=delete",
	"repo:social.colibri.reaction?action=create&action=delete",
	"repo:app.bsky.actor.profile?action=create&action=update",
];

/**
 * Redis key namespace for OAuth state and session entries.
 *
 * - State entries (short-lived, used during the authorization flow):
 *   `oauth:state:STATE_KEY`
 *
 * - Session entries (long-lived, tied to the access/refresh token lifetime):
 *   `oauth:session:SUB`
 */
const stateKey = (key: string) => `oauth:state:${key}`;
const sessionKey = (sub: string) => `oauth:session:${sub}`;

/**
 * How long (in seconds) to keep authorization state entries around.
 * One hour is comfortably more than any real-world authorization round-trip.
 */
const STATE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Derive a session TTL from the token set stored inside `NodeSavedSession`.
 *
 * - If the token set carries an `expires_at` ISO timestamp we use the
 *   remaining duration from now, adding a 5-minute grace period so the
 *   session record is still readable right at the moment the access token
 *   expires (the client will then use the refresh token to get a new one,
 *   which triggers a `sessionStore.set` call that will reset the TTL).
 * - If `expires_at` is absent (e.g. the server did not advertise a lifetime)
 *   we fall back to 90 days, which covers the typical maximum refresh-token
 *   lifetime seen in atproto implementations.
 */
const deriveSessionTtlSeconds = (session: NodeSavedSession): number => {
	const FALLBACK_TTL = 60 * 60 * 24 * 90; // 90 days
	const GRACE_SECONDS = 60 * 5; // 5 minutes

	const expiresAt = session.tokenSet?.expires_at;
	if (!expiresAt) return FALLBACK_TTL;

	const expiresAtMs = new Date(expiresAt).getTime();
	if (Number.isNaN(expiresAtMs)) return FALLBACK_TTL;

	const remainingSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);

	// If the access token is already expired the session is still useful as
	// long as a refresh token is present; keep it for the fallback duration.
	if (remainingSeconds <= 0) {
		return session.tokenSet?.refresh_token ? FALLBACK_TTL : 0;
	}

	return remainingSeconds + GRACE_SECONDS;
};

/**
 * Private keys are stored as base64 encrypted single line values.
 * @param key The key to decode.
 * @returns The decoded key.
 */
const decodePrivateKey = (key: string) =>
	Buffer.from(key, "base64").toString("utf-8");

// See https://npmx.dev/package/@atproto/oauth-client-node#user-content-from-a-backend-service
export const client = new NodeOAuthClient({
	// This object will be used to build the payload of the /client-metadata.json
	// endpoint metadata, exposing the client metadata to the OAuth server.
	clientMetadata: {
		client_id: import.meta.env.DEV
			? `http://localhost/?redirect_uri=${encodeURIComponent("http://127.0.0.1:4321/auth/callback")}&scope=${encodeURIComponent(scopes.join(" "))}`
			: `${import.meta.env.SITE}/oauth-client-metadata.json`,
		client_name: "Colibri Chat",
		client_uri: import.meta.env.SITE,
		logo_uri: `${import.meta.env.SITE}/logo.png`,
		tos_uri: `${import.meta.env.SITE}/tos`,
		policy_uri: `${import.meta.env.SITE}/policy`,
		redirect_uris: [
			import.meta.env.DEV
				? `http://127.0.0.1:4321/auth/callback`
				: `${import.meta.env.SITE}/auth/callback`,
		],
		grant_types: ["authorization_code", "refresh_token"],
		scope: scopes.join(" "),
		response_types: ["code"],
		application_type: "web",
		token_endpoint_auth_method: "private_key_jwt",
		token_endpoint_auth_signing_alg: "RS256",
		dpop_bound_access_tokens: true,
		jwks_uri: `${import.meta.env.SITE}/jwks.json`,
	},

	// Used to authenticate the client to the token endpoint. Will be used to
	// build the jwks object to be exposed on the "jwks_uri" endpoint.
	keyset: await Promise.all([
		JoseKey.fromImportable(decodePrivateKey(PRIVATE_KEY_1), "key1"),
		JoseKey.fromImportable(decodePrivateKey(PRIVATE_KEY_2), "key2"),
	]),

	// Interface to store authorization state data (during authorization flows).
	// Entries are short-lived: we apply a fixed 1-hour TTL and delete
	// explicitly after a successful callback.
	stateStore: {
		async set(key: string, internalState: NodeSavedState): Promise<void> {
			const redis = await getRedisClient();
			await redis.set(stateKey(key), JSON.stringify(internalState), {
				EX: STATE_TTL_SECONDS,
			});
		},
		async get(key: string): Promise<NodeSavedState | undefined> {
			const redis = await getRedisClient();
			const raw = await redis.get(stateKey(key));
			if (!raw) return undefined;
			return JSON.parse(raw) as NodeSavedState;
		},
		async del(key: string): Promise<void> {
			const redis = await getRedisClient();
			await redis.del(stateKey(key));
		},
	},

	// Interface to store authenticated session data.
	// TTL is derived from the token set's `expires_at` field (access token
	// lifetime + 5-minute grace), falling back to 90 days when absent so that
	// long-lived refresh tokens are not evicted prematurely.
	sessionStore: {
		async set(sub: string, session: NodeSavedSession): Promise<void> {
			const redis = await getRedisClient();
			const ttl = deriveSessionTtlSeconds(session);

			if (ttl <= 0) {
				// Token is already expired and has no refresh token — no point storing it.
				await redis.del(sessionKey(sub));
				return;
			}

			await redis.set(sessionKey(sub), JSON.stringify(session), {
				EX: ttl,
			});
		},
		async get(sub: string): Promise<NodeSavedSession | undefined> {
			const redis = await getRedisClient();
			const raw = await redis.get(sessionKey(sub));
			if (!raw) return undefined;
			return JSON.parse(raw) as NodeSavedSession;
		},
		async del(sub: string): Promise<void> {
			const redis = await getRedisClient();
			await redis.del(sessionKey(sub));
		},
	},

	// A lock to prevent concurrent access to the session store. Optional if only one instance is running.
	// requestLock,
});
