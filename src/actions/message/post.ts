import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import type { Facet } from "@/utils/atproto/rich-text";
import { ColibriSDK } from "@/utils/sdk";

const input = z.object({
	text: z.string().max(2048),
	facets: z.array(z.custom<Facet>()),
	channel: z.string(),
	createdAt: z.string().datetime(),
	parent: z.string().optional(),
});

export type PostMessageInput = z.infer<typeof input>;

export const postMessage = defineAction({
	input,
	handler: async (
		{ text, channel, createdAt, parent, facets },
		{ session },
	) => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			channel = "3mfyslcdt7d2c";

			const user = (await session.get("user"))!;
			const oauthSession = await client.restore(user.sub!);
			const agent = new Agent(oauthSession);
			const sdk = new ColibriSDK(agent);

			const message = await sdk.createMessageData(
				agent.did!,
				channel,
				text,
				createdAt,
				facets,
				parent,
			);

			return {
				channel,
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
