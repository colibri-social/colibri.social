import { actions } from "astro:actions";
import { createResource, Show, type Component } from "solid-js";

/**
 * Fetches relevant data for embeds.
 * @param uri The URI to fetch the data for.
 * @returns The embed data or undefined if none was found.
 */
const fetchEmbedData = async (uri: string) => {
	const { error, data } = await actions.getEmbedDataForURI({ uri });

	if (error) return undefined;

	return data;
};

/**
 * @todo Display suspense, different twitter card types for images
 */
export const LinkEmbed: Component<{ uri: string }> = (props) => {
	const [embedData] = createResource(props.uri, fetchEmbedData);

	return (
		<div
			class="flex flex-col border-l-2 px-4 p-2 bg-card my-2 rounded-r-sm max-w-[416px]"
			style={{ "border-color": embedData()?.themeColor }}
		>
			<span class="text-sm">{embedData()?.siteName}</span>
			<a
				class="font-medium w-fit text-(--primary-hover)! decoration-(--primary-hover) hover:underline"
				href={props.uri}
			>
				{embedData()?.title}
			</a>
			<span class="font-light text-sm">{embedData()?.description}</span>
			<Show when={embedData()?.image}>
				<img
					width={400}
					height={210}
					class="w-full h-auto rounded-xs my-2 bg-muted border-none"
					src={
						embedData()?.image![0].url.includes("http")
							? embedData()?.image![0].url
							: new URL(props.uri).protocol +
								"//" +
								new URL(props.uri).host +
								embedData()?.image![0].url
					}
					alt={embedData()?.image![0].alt || ""}
				/>
			</Show>
		</div>
	);
};
