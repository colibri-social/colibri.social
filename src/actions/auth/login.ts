import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { client, scopes } from "@/utils/atproto/oauth";

export const login = defineAction({
	accept: "form",
	input: z.object({
		handle: z.string().optional(),
	}),
	handler: async ({ handle }) => {
		try {
			const url = await client.authorize(handle || "https://bsky.social", {
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
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
