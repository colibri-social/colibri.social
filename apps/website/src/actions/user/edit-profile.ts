import { ActionError, defineAction } from "astro:actions";
import { Agent, type BlobRef } from "@atproto/api";
import { z } from "astro/zod";
import { client } from "@/utils/atproto/oauth";
import { blobRefToUrl, resolvePdsUrl } from "@/utils/sdk";
import { base64ToBlob } from "../community/create";

const imageSchema = z.object({
	base64: z
		.string()
		.refine(
			(val) =>
				/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(
					val,
				),
			{ message: "Image must be a valid base64-encoded image data URL" },
		),
	type: z.string({ message: "No MIME-type given." }),
});

const uploadImage = async (
	agent: Agent,
	image: z.infer<typeof imageSchema>,
): Promise<BlobRef> => {
	const blob = base64ToBlob(image.base64, image.type);

	const res = await agent.com.atproto.repo.uploadBlob(blob);

	return res.data.blob;
};

export const editProfile = defineAction({
	input: z.object({
		name: z.string({ message: "No name given." }),
		description: z.string({ message: "No description given." }).max(256),
		image: imageSchema.optional(),
		banner: imageSchema.optional(),
	}),
	handler: async ({ name, description, image, banner }, { session }) => {
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

			let imageBlob: BlobRef | undefined;
			let bannerBlob: BlobRef | undefined;

			if (image) {
				imageBlob = await uploadImage(agent, image);
			}
			if (banner) {
				bannerBlob = await uploadImage(agent, banner);
			}

			let existingImage: BlobRef | undefined;
			let existingBanner: BlobRef | undefined;

			await agent.upsertProfile((existing) => {
				existingImage = existing?.avatar;
				existingBanner = existing?.banner;

				return {
					...existing,
					displayName: name,
					description,
					avatar: imageBlob,
					banner: bannerBlob,
				};
			});

			const pdsUrl = await resolvePdsUrl(agent.did!);

			const imageUrl =
				(imageBlob || existingImage) && !!pdsUrl
					? blobRefToUrl(
							pdsUrl,
							agent.did!,
							(imageBlob || existingImage) as BlobRef,
						) || undefined
					: undefined;

			const bannerUrl =
				(bannerBlob || existingBanner) && !!pdsUrl
					? blobRefToUrl(
							pdsUrl,
							agent.did!,
							(bannerBlob || existingBanner) as BlobRef,
						) || undefined
					: undefined;

			session.set("user", {
				...user,
				displayName: name,
				description,
				avatar: imageUrl,
				banner: bannerUrl,
			});

			return {
				imageUrl,
				bannerUrl,
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
