import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const postMessage = defineAction({
	input: z.object({
		text: z.string().max(2048),
		community: z.string(),
		channel: z.string(),
	}),
	handler: async ({ text, community, channel }, { session }) => {
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

			const message = await sdk.createMessageData(
				agent.did!,
				channel,
				text,
				new Date().toISOString(),
			);
			console.log(message);

			return {
				community,
				channel,
				message,
			};
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: "Internal Server Error while creating community.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
