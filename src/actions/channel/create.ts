import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const createChannel = defineAction({
	input: z.object({
		name: z.string().min(1).max(32),
		type: z.enum(["text", "voice", "forum"]),
		category: z.string(),
	}),
	handler: async ({ name, type, category }, { session }) => {
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

			const channel = await sdk.createChannelData(
				agent.did!,
				category,
				name,
				type,
			);
			await sdk.addChannelToCategory(agent.did!, category, channel);

			return {
				category,
				channel,
			};
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: "Internal Server Error while creating channel.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
