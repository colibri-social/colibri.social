import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const editChannel = defineAction({
	input: z.object({
		name: z.string().min(1).max(32),
		description: z.string({ message: "A description is required." }).max(256),
		rkey: z.string(),
	}),
	handler: async ({ name, description, rkey }, { session }) => {
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

			const channelData = await sdk.editChannel(
				agent.did!,
				name,
				description,
				rkey,
			);

			return channelData;
		} catch (e) {
			console.error(e);

			console.log((e as Error).message);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
