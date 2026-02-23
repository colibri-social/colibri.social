import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const deleteMessage = defineAction({
	input: z.object({
		rkey: z.string(),
	}),
	handler: async ({ rkey }, { session }) => {
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

			const message = await sdk.deleteMessage(agent.did!, rkey);

			return {
				message,
			};
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: "Internal Server Error while posting message.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
