import { ActionError, defineAction } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { INVITE_API_KEY } from "astro:env/server";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export type InviteCodeInfo = {
	code: string;
	community_uri: string;
	created_by_did: string;
	max_uses: number | null;
	use_count: number;
	active: boolean;
};

export const listInviteCodes = defineAction({
	input: z.object({
		community: z.string({ message: "No community given." }),
	}),
	handler: async ({ community }, { session }) => {
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

		const res = await fetch(
			`https://${APPVIEW_DOMAIN}/api/invites?community=${encodeURIComponent(`at://${agent.did!}/${RECORD_IDs.COMMUNITY}/${community}`)}`,
			{
				headers: new Headers({
					Authorization: `Bearer ${INVITE_API_KEY}`,
				}),
			},
		);

		return (await res.json()) as Array<InviteCodeInfo>;
	},
});

/**
 * Checks for existing invite links for a community. If none exist, creates a new one.
 */
export const createInviteCode = defineAction({
	input: z.object({
		community: z.string({ message: "No community given." }),
		owner: z.string({ message: "No owner given." }),
	}),
	handler: async ({ community, owner }, { session }) => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const user = (await session.get("user"))!;

			if (user.sub !== owner) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const info = (await (
				await fetch(
					`https://${APPVIEW_DOMAIN}/api/invites?community=${encodeURIComponent(`at://${owner}/${RECORD_IDs.COMMUNITY}/${community}`)}`,
					{
						method: "GET",
						headers: new Headers({
							Authorization: `Bearer ${INVITE_API_KEY}`,
						}),
					},
				)
			).json()) as Array<InviteCodeInfo>;

			if (info.length > 0) {
				return info[0].code;
			}

			// Create new code if none exists yet
			const { code } = (await (
				await fetch(`https://${APPVIEW_DOMAIN}/api/invite`, {
					method: "POST",
					body: JSON.stringify({
						community_uri: `at://${owner}/${RECORD_IDs.COMMUNITY}/${community}`,
						owner_did: owner,
						max_uses: null, // Useful later on if needed
					}),
					headers: new Headers({
						Authorization: `Bearer ${INVITE_API_KEY}`,
					}),
				})
			).json()) as { code: string };

			return code;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});

export const deleteInviteCode = defineAction({
	input: z.object({
		code: z.string({ message: "No code given." }),
		owner: z.string({ message: "No owner given." }),
	}),
	handler: async ({ code, owner }, { session }) => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const user = (await session.get("user"))!;

			if (user.sub !== owner) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			await fetch(
				`https://${APPVIEW_DOMAIN}/api/invite/${code}?owner_did=${owner}`,
				{
					method: "DELETE",
					headers: new Headers({
						Authorization: `Bearer ${INVITE_API_KEY}`,
					}),
				},
			);

			return code;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
