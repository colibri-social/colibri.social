import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import * as devalue from "devalue";
import type { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";

export const getUserProfileData = defineAction({
	input: z.object({
		did: z.string({ message: "No DID given." }),
	}),
	handler: async ({ did }, { session }) => {
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

			const profile = await agent.getProfile({
				actor: did,
			});

			try {
				devalue.stringify(JSON.parse(JSON.stringify(profile.data)));
			} catch (e) {
				console.error(e);
				throw new Error("Panic");
			}

			return JSON.parse(JSON.stringify(profile.data)) as ProfileViewDetailed;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
