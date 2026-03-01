import { ActionError, defineAction } from "astro:actions";
import { isAtIdentifierString } from "@atproto/lex";
import { z } from "astro/zod";
import { client, scopes } from "@/utils/atproto/oauth";

/**
 * Resolves a handle using bluesky as the resolver.
 * @param handle The handle to resolve.
 * @param pds The domain of the PDS.
 * @returns The DID associated with the handle.
 */
const resolveHandle = async (
	handle: string,
	pds: string,
): Promise<string | undefined> => {
	try {
		const res = await fetch(
			`https://${pds}/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
		);
		const data = await res.json();
		return data.did;
	} catch (e) {
		console.error(e);
		return undefined;
	}
};

const resolvePotentialHandle = async (
	handle: string | undefined,
): Promise<string | ActionError | undefined> => {
	if (!handle) return undefined;

	if (!isAtIdentifierString(handle)) {
		return new ActionError({
			code: "BAD_REQUEST",
			message: "Invalid handle",
		});
	}

	return await resolveHandle(handle, "bsky.social");
};

export const login = defineAction({
	accept: "form",
	input: z.object({
		handle: z.string().optional(),
	}),
	handler: async ({ handle }) => {
		try {
			const didOrError = await resolvePotentialHandle(handle);

			if (didOrError instanceof ActionError) return didOrError;

			const url = await client.authorize(didOrError || "https://bsky.social", {
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
				message: "Internal Server Error while logging in.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
