import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { INVITE_API_KEY } from "astro:env/server";

export const blockDidFromCommunity = defineAction({
	input: z.object({
		member: z.string({ message: "No member DID given." }),
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ member, community }, { session }) => {
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

		await sdk.getCommunityData(agent.did!, community);

		await fetch(`https://${APPVIEW_DOMAIN}/api/community/ban`, {
			method: "POST",
			headers: new Headers({
				Authorization: `Bearer ${INVITE_API_KEY}`,
			}),
			body: JSON.stringify({
				community_uri: `at://${agent.did!}/${RECORD_IDs.COMMUNITY}/${community}`,
				member_did: member,
			}),
		});

		return;
	},
});

export const unblockDidFromCommunity = defineAction({
	input: z.object({
		member: z.string({ message: "No member DID given." }),
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ member, community }, { session }) => {
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

		await sdk.getCommunityData(agent.did!, community);

		await fetch(
			`https://${APPVIEW_DOMAIN}/api/community/ban?community=${encodeURIComponent(`at://${agent.did!}/${RECORD_IDs.COMMUNITY}/${community}`)}&member_did=${encodeURIComponent(member)}`,
			{
				method: "DELETE",
				headers: new Headers({
					Authorization: `Bearer ${INVITE_API_KEY}`,
				}),
			},
		);

		return;
	},
});
