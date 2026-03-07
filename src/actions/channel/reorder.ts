import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const reorderChannels = defineAction({
	input: z.object({
		categoryRkey: z.string(),
		channelOrder: z.array(z.string()),
	}),
	handler: async ({ categoryRkey, channelOrder }, { session }) => {
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

			const existingRecord = await sdk.getCategoryData(agent.did!, categoryRkey);

			await sdk.modifyCategoryData(agent.did!, categoryRkey, {
				...existingRecord,
				channelOrder,
			});
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
