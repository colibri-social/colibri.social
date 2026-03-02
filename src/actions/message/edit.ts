import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import type { Facet } from "@/utils/atproto/rich-text";

export const editMessage = defineAction({
	input: z.object({
		text: z.string().max(2048),
		facets: z.array(z.custom<Facet>()),
		rkey: z.string(),
		channel: z.string(),
	}),
	handler: async ({ text, channel, facets, rkey }, { session }) => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const user = (await session.get("user"))!;
			const oauthSession = await client.restore(user.sub!);
			const agent = new Agent(oauthSession);
			const sdk = new ColibriSDK(agent);

			await sdk.editMessage(agent.did!, channel, text, facets, rkey);

			return {
				channel,
				text,
				rkey,
			};
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
