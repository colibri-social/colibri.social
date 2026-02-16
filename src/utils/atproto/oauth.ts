import { NodeOAuthClient, type NodeSavedState, type NodeSavedSession } from '@atproto/oauth-client-node';
import { JoseKey } from '@atproto/jwk-jose';
import { PRIVATE_KEY_1, PRIVATE_KEY_2 } from "astro:env/server";

export const scopes = [
	"atproto",
	"transition:generic",
	"repo:social.colibri.actor.data?action=create",
	"repo:social.colibri.community?action=create",
	"repo:social.colibri.category?action=create",
	"repo:social.colibri.channel?action=create",
	"repo:social.colibri.message?action=create"
];

const stateMap = new Map();
const sessionMap = new Map();

// See https://npmx.dev/package/@atproto/oauth-client-node#user-content-from-a-backend-service
export const client = new NodeOAuthClient({
  // This object will be used to build the payload of the /client-metadata.json
  // endpoint metadata, exposing the client metadata to the OAuth server.
  clientMetadata: {
    client_id: 'https://colibri.lou.gg/.well-known/client-metadata.json',
    client_name: 'My App',
    client_uri: 'https://colibri.lou.gg',
    logo_uri: 'https://colibri.lou.gg/logo.png',
    tos_uri: 'https://colibri.lou.gg/tos',
    policy_uri: 'https://colibri.lou.gg/policy',
    redirect_uris: ['https://colibri.lou.gg/auth/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: scopes.join(" "),
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'RS256',
    dpop_bound_access_tokens: true,
    jwks_uri: 'https://colibri.lou.gg/jwks.json',
  },

  // Used to authenticate the client to the token endpoint. Will be used to
  // build the jwks object to be exposed on the "jwks_uri" endpoint.
  keyset: await Promise.all([
    JoseKey.fromImportable(PRIVATE_KEY_1, 'key1'),
    JoseKey.fromImportable(PRIVATE_KEY_2, 'key2'),
  ]),

  // TODO: Move the following three things to Redis. See https://npmx.dev/package/@atproto/oauth-client-node#user-content-requestlock
  // for more info.
  // NOTE: https://npmx.dev/package/@atproto/oauth-client-node#user-content-requestlock could be relevant.

  // Interface to store authorization state data (during authorization flows)
  stateStore: {
		async set(key: string, internalState: NodeSavedState): Promise<void> {
			stateMap.set(key, internalState);
    },
    async get(key: string): Promise<NodeSavedState | undefined> {
			return stateMap.get(key);
		},
		async del(key: string): Promise<void> {
			stateMap.delete(key);
    },
  },

  // Interface to store authenticated session data
  sessionStore: {
		async set(sub: string, session: NodeSavedSession): Promise<void> {
			sessionMap.set(sub, session);
    },
    async get(sub: string): Promise<NodeSavedSession | undefined> {
			return sessionMap.get(sub);
		},
    async del(sub: string): Promise<void> {
			sessionMap.delete(sub);
		},
  },

  // A lock to prevent concurrent access to the session store. Optional if only one instance is running.
  // requestLock,
})
