import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const reorderChannels = defineAction({
	input: z.object({
		channelRkey: z.string(),
		sourceCategoryRkey: z.string(),
		sourceChannelOrder: z.array(z.string()),
		destCategoryRkey: z.string(),
		destChannelOrder: z.array(z.string()),
	}),
	handler: async (
		{
			channelRkey,
			sourceCategoryRkey,
			sourceChannelOrder,
			destCategoryRkey,
			destChannelOrder,
		},
		{ session },
	) => {
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

			const did = agent.did!;
			const isCrossCategory = sourceCategoryRkey !== destCategoryRkey;

			if (isCrossCategory) {
				// Update both categories and the channel's category field in parallel.
				const [srcRecord, dstRecord, channelRecord] = await Promise.all([
					sdk.getCategoryData(did, sourceCategoryRkey),
					sdk.getCategoryData(did, destCategoryRkey),
					sdk.getChannelData(did, channelRkey),
				]);

				await Promise.all([
					sdk.modifyCategoryData(did, sourceCategoryRkey, {
						...srcRecord,
						channelOrder: sourceChannelOrder,
					}),
					sdk.modifyCategoryData(did, destCategoryRkey, {
						...dstRecord,
						channelOrder: destChannelOrder,
					}),
					agent.com.atproto.repo.putRecord({
						repo: did,
						collection: "social.colibri.channel",
						rkey: channelRkey,
						record: {
							$type: "social.colibri.channel",
							name: channelRecord.name,
							description: channelRecord.description,
							type: channelRecord.type,
							community: channelRecord.community,
							category: destCategoryRkey,
						},
					}),
				]);
			} else {
				// Same-category reorder: only update the one category.
				const existingRecord = await sdk.getCategoryData(did, sourceCategoryRkey);
				await sdk.modifyCategoryData(did, sourceCategoryRkey, {
					...existingRecord,
					channelOrder: destChannelOrder,
				});
			}
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
