import { PRIVATE_KEY_1, PRIVATE_KEY_2 } from "astro:env/server";
import { serverPort } from "virtual:server-port";
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
	"repo:social.colibri.membership?action=create&action=delete",
	"repo:social.colibri.approval?action=create&action=delete",
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
			? `http://localhost/?redirect_uri=${encodeURIComponent(`http://127.0.0.1:${serverPort}/auth/callback`)}&scope=${encodeURIComponent(scopes.join(" "))}`
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
	stateStore: {
		async set(key: string, internalState: NodeSavedState): Promise<void> {
			const redis = await getRedisClient();
			await redis.set(stateKey(key), JSON.stringify(internalState), {
				expiration: {
					type: "EX",
					value: 60 * 60,
				},
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
	sessionStore: {
		async set(sub: string, session: NodeSavedSession): Promise<void> {
			const redis = await getRedisClient();
			await redis.set(sessionKey(sub), JSON.stringify(session));
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
