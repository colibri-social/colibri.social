import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const deleteCommunity = defineAction({
	input: z.object({
		rkey: z.string(),
	}),
	handler: async ({ rkey }, { session }) => {
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

			await sdk.deleteCommunity(agent.did!, rkey);

			return;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: "Internal Server Error while creating community.",
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});

function base64ToBlob(base64: string, contentType = "", sliceSize = 512) {
	const byteCharacters = atob(base64.split(",")[1]);
	const byteArrays = [];

	for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		const slice = byteCharacters.slice(offset, offset + sliceSize);

		const byteNumbers = new Array(slice.length);
		for (let i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}

	const blob = new Blob(byteArrays, { type: contentType });
	return blob;
}
