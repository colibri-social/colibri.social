import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import { RECORD_IDs } from "@/utils/atproto/lexicons";

export const leaveCommunity = defineAction({
	input: z.object({
		community: z.string({ message: "No community given." }),
		ownerDID: z.string({ message: "No Owner DID given." }),
	}),
	handler: async ({ community, ownerDID }, { session }) => {
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

			await sdk.deleteMembershipDeclaration(
				agent.did!,
				`at://${ownerDID}/${RECORD_IDs.COMMUNITY}/${community}`,
			);

			return;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
