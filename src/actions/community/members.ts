import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import type { MemberData } from "@/components/solid/layouts/CommunityLayout";

export const listPendingMembers = defineAction({
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

			const atURI = `at://${owner}/${RECORD_IDs.COMMUNITY}/${community}`;

			const memberData = (await (
				await fetch(
					`https://${APPVIEW_DOMAIN}/api/members?community=${encodeURIComponent(atURI)}`,
				)
			).json()) as Array<MemberData>;

			return memberData.filter((x) => x.status === "pending");
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
