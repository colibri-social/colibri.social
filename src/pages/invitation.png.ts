import { APPVIEW_DOMAIN } from "astro:env/client";
import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import { html } from "satori-html";
import type { UnresolvedCommunityData } from "@/utils/sdk";

const test = (name: string, image?: { did: string; cid: string }) => {
	return html`<div
		style="
			display: flex;
			justify-items: center;
			align-items: center;
			background-image: url('https://colibri.social/og-template.png');
			height: 100%;
			width: 100%;
			padding: 2rem;
			font-family: 'Hanken Grotesk';
		"
	>
		<div
			style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3rem; width: 100%; height: 100%; border-radius: 2rem; overflow: hidden; background-image: linear-gradient(to bottom, #0A0A0A, #151515);"
		>
			<img
				src="https://colibri.social/tree.png"
				style="position: absolute; top: 0px; right: -4px; width: 511.5px; height: 343.5px; border-radius: 37px;"
			/>
			${() =>
				image
					? `<img
				src="https://${APPVIEW_DOMAIN}/api/blob?did=${image?.did}&cid=${image?.cid}"
				style="border-radius: 1rem; border: 1px solid #353535; width: 128px; height: 128px; background: #171717; object-fit: cover;"
			/>`
					: ""}
			<div
				style="display: flex; flex-direction: column; align-items: center; justify-content: center;"
			>
				<span style="color: #8E51FF; font-size: 1.25em;"
					>You've been invited to join</span
				>
				<h1 style="font-family: Stardom; color: white; font-size: 5em;">
					${name}
				</h1>
				<div
					style="display: flex; flex-direction: row; gap: 0.5rem; align-items: center;"
				>
					<span style="color: #c7c7c7; font-size: 1.25em;">on</span>
					<img
						src="https://colibri.social/logo.png"
						style="width: 32px; height: 32px; border-radius: 99px;"
					/>
					<span style="color: #c7c7c7; font-size: 1.25em;">colibri.social</span>
				</div>
			</div>
		</div>
	</div> `;
};

export const GET: APIRoute = async (request) => {
	try {
		const url = new URL(request.url);

		const community = url.searchParams.get("community");

		if (!community) {
			return new Response("No community given.", {
				status: 400,
			});
		}

		const stardomFontFile = await fetch(
			"https://colibri.social/Stardom-Regular.woff",
		);
		const stardomFontData: ArrayBuffer = await stardomFontFile.arrayBuffer();
		const hankenGroteskFontFile = await fetch(
			"https://colibri.social/HankenGrotesk-Regular.ttf",
		);
		const hankenGroteskFontData: ArrayBuffer =
			await hankenGroteskFontFile.arrayBuffer();

		const communityData = (await (
			await fetch(
				`https://${APPVIEW_DOMAIN}/api/community?community=${community}`,
			)
		).json()) as UnresolvedCommunityData;

		return await satoriAstroOG({
			template: test(
				communityData.name,
				communityData.picture
					? {
							did: communityData.owner_did,
							cid: communityData.picture.ref.$link,
						}
					: undefined,
			),
			width: 1200,
			height: 630,
		}).toResponse({
			satori: {
				fonts: [
					{
						name: "Hanken Grotesk",
						data: hankenGroteskFontData,
						style: "normal",
						weight: 400,
					},
					{
						name: "Stardom",
						data: stardomFontData,
						style: "normal",
						weight: 400,
					},
				],
			},
		});
	} catch (err) {
		console.error(err);
		return new Response("Invalid community given.", {
			status: 400,
		});
	}
};
