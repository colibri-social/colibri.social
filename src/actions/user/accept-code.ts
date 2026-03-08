import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK, type UnresolvedCommunityData } from "@/utils/sdk";
import { INVITE_API_KEY } from "astro:env/server";
import { APPVIEW_DOMAIN } from "astro:env/client";
import type { InviteCodeInfo } from "../community/invite";
import { RECORD_IDs } from "@/utils/atproto/lexicons";

export const acceptInvitation = defineAction({
	input: z.object({
		code: z.string(),
	}),
	handler: async ({ code }, { session }) => {
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

			const communityData = (await (
				await fetch(`https://${APPVIEW_DOMAIN}/api/invite/${code}`, {
					method: "GET",
					headers: new Headers({
						Authorization: `Bearer ${INVITE_API_KEY}`,
					}),
				})
			).json()) as InviteCodeInfo & {
				community: UnresolvedCommunityData;
			};

			if (!communityData.active) {
				throw new ActionError({
					message: "Invite link has expired!",
					code: "BAD_REQUEST",
				});
			}

			const communityAtUri = `at://${communityData.community.owner_did}/${RECORD_IDs.COMMUNITY}/${communityData.community.rkey}`;

			const membershipRkey = await sdk.createMembershipDeclaration(
				agent.did!,
				communityAtUri,
			);

			try {
				const ownerSession = await client.restore(
					communityData.community.owner_did,
				);
				const owner = new Agent(ownerSession);

				await sdk.createJoinApproval(
					owner.did!,
					`at://${agent.did!}/${RECORD_IDs.MEMBERSHIP}/${membershipRkey}`,
					communityAtUri,
					owner,
				);
			} catch (e) {
				console.error(e);
				// TODO: catch and notify user that accepting declaration could not be resolved
			}

			// TODO: wait for websocket

			return communityAtUri.split("/").pop()!;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
