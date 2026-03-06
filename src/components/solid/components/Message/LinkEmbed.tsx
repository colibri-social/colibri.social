import { actions } from "astro:actions";
import {
	createEffect,
	createResource,
	on,
	Show,
	type Component,
} from "solid-js";
import { useMessageContext } from "../../contexts/MessageContext";

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
 * @todo Display suspense, different twitter card types for images,
 * figure out why links only produce two messages in chat, re-scroll
 * chat when embeds appear on latest message
 */
export const LinkEmbed: Component<{ uri: string }> = (props) => {
	const [, { notifyEmbedLoad }] = useMessageContext();
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
				class="flex flex-col border-l-2 px-4 p-2 bg-card mb-2 rounded-r-sm max-w-[416px]"
				style={{ "border-color": embedData()!.themeColor }}
			>
				<span class="text-sm">{embedData()!.siteName}</span>
				<a
					class="font-medium w-fit text-(--primary-hover)! decoration-(--primary-hover) hover:underline"
					href={props.uri}
					target="_blank"
				>
					{embedData()!.title}
				</a>
				<span class="font-light text-sm">{embedData()!.description}</span>
				<Show when={embedData()!.image}>
					<img
						width={400}
						height={210}
						class="w-full h-auto rounded-xs my-2 bg-muted border-none"
						src={
							embedData()!.image![0].url.includes("http")
								? embedData()!.image![0].url
								: new URL(props.uri).protocol +
									"//" +
									new URL(props.uri).host +
									embedData()!.image![0].url
						}
						alt={embedData()!.image![0].alt || ""}
					/>
				</Show>
			</div>
		</Show>
	);
};
