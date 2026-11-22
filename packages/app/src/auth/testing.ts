import type { OAuthSession } from "@atproto/oauth-client-browser";
import {
	buildScopes,
	EMOJI_COLLECTIONS,
	PERMISSION_SET_RESOURCES,
	WILDCARD_RPC,
} from "@colibri-social/lib";
import { appViewDid } from "./appview";
import type { AuthOptions, LoadOAuthClient, OAuthClientLike } from "./auth";

export const FULL_SCOPE = buildScopes(appViewDid()).join(" ");

export const expandedScope = (
	options: { omitSets?: string[]; omitMethods?: string[] } = {},
) => {
	const audience = `${appViewDid()}%23colibri_appview`;
	const omitted = new Set(options.omitMethods ?? []);
	return [
		"atproto",
		"blob:*/*",
		...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
		...EMOJI_COLLECTIONS.map((collection) => `repo:${collection}`),
		...Object.entries(PERMISSION_SET_RESOURCES)
			.filter(([nsid]) => !options.omitSets?.includes(nsid))
			.map(([, resources]) => {
				const kept = resources.filter((resource) => !omitted.has(resource));
				return `rpc?${kept.map((lxm) => `lxm=${lxm}`).join("&")}&aud=${audience}`;
			}),
	].join(" ");
};

export const fakeSession = (did: string, scope = FULL_SCOPE): OAuthSession =>
	({
		did,
		sub: did,
		fetchHandler: async () => new Response("{}", { status: 200 }),
		getTokenInfo: async () => ({ scope }),
	}) as unknown as OAuthSession;

export type FakeClientState = {
	stored?: OAuthSession;
	callbackSession?: OAuthSession;
	restoreError?: unknown;
	authorizeUrl?: string;
	signIn?: (input: string) => Promise<never>;
	calls: Array<{ method: string; input?: string; options?: unknown }>;
};

export const fakeClient = (
	state: FakeClientState,
): { client: OAuthClientLike; load: LoadOAuthClient } => {
	const client = {
		clientMetadata: { redirect_uris: ["social.colibri:/oauth/callback"] },
		init: async () => {
			state.calls.push({ method: "init" });
			return undefined;
		},
		restore: async (sub: string) => {
			state.calls.push({ method: "restore", input: sub });
			if (state.restoreError) throw state.restoreError;
			if (state.stored?.sub === sub) return state.stored;
			throw new Error("no session");
		},
		revoke: async (sub: string) => {
			state.calls.push({ method: "revoke", input: sub });
		},
		callback: async (params: URLSearchParams) => {
			state.calls.push({ method: "callback", input: params.toString() });
			if (params.has("error")) throw new Error(params.get("error") ?? "");
			if (!state.callbackSession) throw new Error("no session");
			return { session: state.callbackSession, state: null };
		},
		authorize: async (input: string, options?: unknown) => {
			state.calls.push({ method: "authorize", input, options });
			return new URL(state.authorizeUrl ?? "https://pds.example/authorize");
		},
		signIn: async (input: string, options?: unknown) => {
			state.calls.push({ method: "signIn", input, options });
			if (state.signIn) return state.signIn(input);
			return new Promise<never>(() => {});
		},
	} as unknown as OAuthClientLike;
	return { client, load: async () => client };
};

export const memoryStorage = (
	seed: Record<string, string> = {},
): NonNullable<AuthOptions["storage"]> => {
	const values = new Map(Object.entries(seed));
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		},
	};
};

export const fakeLocation = (
	pathname: string,
	extra: Partial<Location> = {},
) => ({
	hostname: "colibri.social",
	host: "colibri.social",
	port: "",
	pathname,
	search: "",
	hash: "",
	...extra,
});
