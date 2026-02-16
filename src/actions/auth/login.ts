import { ActionError, defineAction } from "astro:actions";
import { isAtIdentifierString } from "@atproto/lex";
import { z } from "astro/zod";
import { client, scopes } from "@/utils/atproto/oauth";

/**
 * Resolves a handle using bluesky as the resolver.
 * @param handle The handle to resolve.
 * @returns The DID associated with the handle.
 */
const resolveHandle = async (handle: string): Promise<string | undefined> => {
	const res = await fetch(
		`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
	);
	const data = await res.json();
	return data.did;
};

export const login = defineAction({
	accept: "form",
	input: z.object({
		handle: z.string(),
	}),
	handler: async ({ handle }) => {
		try {
			if (!isAtIdentifierString(handle)) {
				return new ActionError({
					code: "BAD_REQUEST",
					message: "Invalid handle",
				});
			}

			const did = await resolveHandle(handle);

			if (!did) {
				return new ActionError({
					code: "BAD_REQUEST",
					message: "Unable to resolve given handle",
				});
			}

			const url = await client.authorize(did, {
				scope: scopes.join(" "),
				state: JSON.stringify("{}"),
				redirect_uri: import.meta.env.DEV
					? `http://127.0.0.1:4321/auth/callback`
					: (`${import.meta.env.SITE}/auth/callback` as any),
			});

			return url.toString();
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: "Internal Server Error while creating community.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
