import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import type { ChannelData } from "@/utils/sdk";
import { ColibriSDK } from "@/utils/sdk";
import { RECORD_IDs } from "@/utils/atproto/lexicons";

export const createChannel = defineAction({
	input: z.object({
		name: z
			.string({ message: "A name is required." })
			.min(1, { message: "Name must be at least a singular chacacter." })
			.max(32, { message: "Name must be shorter than 32 characters." }),
		type: z.enum(["text", "voice", "forum"], {
			message: "Channel type must be one of 'text', 'voice', or 'forum'.",
		}),
		category: z.string({ message: "No category given." }),
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ name, type, category, community }, { session }) => {
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

			const rkey = await sdk.createChannelData(
				agent.did!,
				community,
				category,
				name,
				type,
			);
			await sdk.addChannelToCategory(agent.did!, category, rkey);

			const channelData: ChannelData = {
				rkey,
				name,
				type,
				category,
				community,
				uri: `at://${agent.did!}/${RECORD_IDs.CHANNEL}/${rkey}`,
			};

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
