import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const createCategory = defineAction({
	input: z.object({
		community: z.string({ message: "No community given." }),
		name: z
			.string({ message: "A name is required." })
			.min(1, { message: "Name must be at least a singular chacacter." })
			.max(32, { message: "Name must be shorter than 32 characters." }),
	}),
	handler: async ({ community, name }, { session }) => {
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

			const category = await sdk.createCategoryData(
				agent.did!,
				community,
				name,
			);
			await sdk.addCategoryToCommunity(agent.did!, community, category.rkey);

			return category;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
