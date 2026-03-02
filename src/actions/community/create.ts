import { ActionError, defineAction } from "astro:actions";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";

export const createCommunity = defineAction({
	input: z.object({
		name: z.string().min(1).max(32),
		image: z
			.object({
				base64: z
					.string()
					.refine(
						(val) =>
							/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(
								val,
							),
						{ message: "Image must be a valid base64-encoded image data URL" },
					),
				type: z.string(),
			})
			.optional(),
	}),
	handler: async ({ name, image }, { session }) => {
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

			const community = await sdk.createCommunityData(
				agent.did!,
				name,
				"",
				image ? base64ToBlob(image.base64, image.type) : undefined,
			);

			return {
				community,
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
