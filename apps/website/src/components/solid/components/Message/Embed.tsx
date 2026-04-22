import { actions } from "astro:actions";
import {
	type Component,
	createEffect,
	createResource,
	on,
	Show,
} from "solid-js";
import { useChannelContext } from "../../contexts/ChannelContext";
import { Lightbox } from "../Lightbox";

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
 * @todo TODO(app): Display suspense, different twitter card types for images,
 * figure out why links only produce two messages in chat, re-scroll
 * chat when embeds appear on latest message
 */
export const Embed: Component<{ uri: string }> = (props) => {
	const [, { notifyEmbedLoad }] = useChannelContext();
	const [embedData] = createResource(props.uri, fetchEmbedData);

	createEffect(
		on(
			() => embedData.state,
			(state) => {
				if (state === "ready") notifyEmbedLoad();
			},
		),
	);

	return (
		<Show
			when={
				embedData() &&
				Object.keys(embedData()!).some(
					(key) => !!embedData()![key as keyof ReturnType<typeof embedData>],
				)
			}
		>
			<div
				class="flex flex-col border-l-2 px-4 p-2 bg-card mb-2 rounded-r-sm max-w-104"
				style={{ "border-color": embedData()!.themeColor }}
			>
				<span class="text-xs">{embedData()!.siteName}</span>
				<a
					class="font-medium w-fit text-(--primary-hover)! decoration-(--primary-hover) hover:underline"
					href={props.uri}
					target="_blank"
					rel="noreferrer"
				>
					{embedData()!.title}
				</a>
				<span class="font-light text-card-foreground text-sm">
					{embedData()!.description}
				</span>
				<Show when={embedData()!.image}>
					{(image) => {
						const imageUrl = image()[0].url.startsWith("http")
							? image()[0].url
							: new URL(props.uri).protocol +
								"//" +
								new URL(props.uri).host +
								image()[0].url;
						return (
							<Lightbox src={imageUrl}>
								<img
									width={400}
									height={210}
									class="w-full h-auto rounded-xs my-2 bg-muted border-none cursor-pointer"
									src={imageUrl}
									alt={image()[0].alt || ""}
								/>
							</Lightbox>
						);
					}}
				</Show>
			</div>
		</Show>
	);
};
