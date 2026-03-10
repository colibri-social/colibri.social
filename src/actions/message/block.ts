import { ActionError, defineAction } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { INVITE_API_KEY } from "astro:env/server";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const blockMessage = defineAction({
	input: z.object({
		rkey: z.string({ message: "No record key given." }),
		author: z.string({ message: "No author given." }),
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ rkey, author, community }, { session }) => {
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

			// This will fail if the user is not the owner of the community, which is sufficient for now.
			await sdk.getCommunityData(agent.did!, community);

			await fetch(
				`https://${APPVIEW_DOMAIN}/api/message/block?author_did=${encodeURIComponent(author)}&rkey=${rkey}`,
				{
					method: "POST",
					headers: new Headers({
						Authorization: `Bearer ${INVITE_API_KEY}`,
					}),
				},
			);
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
