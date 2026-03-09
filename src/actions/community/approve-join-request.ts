import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import { RECORD_IDs } from "@/utils/atproto/lexicons";

export const approveJoinRequest = defineAction({
	input: z.object({
		member: z.string({ message: "No member DID given." }),
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ member, community }, { session }) => {
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

			const communityAtURI = `at://${agent.did!}/${RECORD_IDs.COMMUNITY}/${community}`;

			// TODO: Fetch declaration from member
			const membership = await sdk.findMembershipDeclaration(
				member,
				communityAtURI,
			);

			if (!membership) {
				throw new ActionError({
					message: "Unable to find membership declaration for user.",
					code: "NOT_FOUND",
				});
			}

			console.log(membership, communityAtURI);

			await sdk.createJoinApproval(agent.did!, membership, communityAtURI);
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
