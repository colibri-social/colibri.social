import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const editCategoryOrder = defineAction({
	input: z.object({
		community: z.string({ message: "No community given." }),
		categoryOrder: z.array(z.string({ message: "Invalid category." }), {
			message: "No category order given.",
		}),
	}),
	handler: async ({ community, categoryOrder }, { session }) => {
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

			const existingRecord = await sdk.getCommunityData(agent.did!, community);

			await sdk.modifyCommunityData(agent.did!, community, {
				...existingRecord,
				categoryOrder,
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
