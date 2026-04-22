import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import type { AttachmentObj } from "@/components/solid/contexts/GlobalContext/events";
import { client } from "@/utils/atproto/oauth";
import type { Facet } from "@/utils/atproto/rich-text";
import { ColibriSDK } from "@/utils/sdk";

const input = z
	.object({
		text: z.string({ message: "No text given." }).max(2048, {
			message: "Text must be shorter than 2048 characters.",
		}),
		facets: z.array(z.custom<Facet>()),
		channel: z.string({ message: "No channel given." }),
		createdAt: z
			.string({ message: "No creation date given." })
			.datetime({ message: "Creation date must be a valid ISO 8601 date." }),
		parent: z.string().optional(),
		attachments: z.array(z.custom<AttachmentObj>()),
	})
	.refine((input) => {
		if (input.attachments.length === 0 && input.text.trim().length === 0)
			return "No files or text given.";

		return true;
	});

export type PostMessageInput = z.infer<typeof input>;

export const postMessage = defineAction({
	input,
	handler: async (
		{ text, channel, createdAt, parent, facets, attachments },
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

			const message = await sdk.createMessageData(
				agent.did!,
				channel,
				text,
				createdAt,
				facets,
				attachments,
				parent,
			);

			return {
				channel,
				message,
			};
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});
