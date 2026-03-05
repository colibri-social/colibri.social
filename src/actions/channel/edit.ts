import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const editChannel = defineAction({
	input: z.object({
		name: z
			.string({ message: "A name is required." })
			.min(1, { message: "Name must be at least a singular chacacter." })
			.max(32, { message: "Name must be shorter than 32 characters." }),
		description: z.string({ message: "A description is required." }).max(256, {
			message: "Description must be shorter than 256 characters.",
		}),
		rkey: z.string({ message: "No record key given." }),
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

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
