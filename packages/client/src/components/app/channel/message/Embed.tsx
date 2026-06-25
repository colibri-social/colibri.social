import { type Component, createResource, Show } from "solid-js";
import { parseBskyPostUrl } from "../../../../atproto/bsky-post-url";
import { resolveEmbedImage } from "../../../../atproto/resolve-blob";
import { useStableMedia } from "../../../../contexts/ScrollAnchor";
import { useUserContext } from "../../../../contexts/User";
import { Lightbox } from "../../common/Lightbox";
import { BlueskyEmbed } from "./BlueskyEmbed";

export const Embed: Component<{ uri: string }> = (props) => {
	// Bluesky post links get a native post card instead of OG scraping
	const bskyPost = () => parseBskyPostUrl(props.uri);

	return (
		<Show when={bskyPost()} fallback={<OpenGraphEmbed uri={props.uri} />}>
			{(post) => <BlueskyEmbed uri={props.uri} post={post()} />}
		</Show>
	);
};

const OpenGraphEmbed: Component<{ uri: string }> = (props) => {
	const user = useUserContext();
	const stableMedia = useStableMedia();

	const [embedData] = createResource(
		() => props.uri,
		(uri) => user.xrpc.social.colibri.embed.getMetadata(uri),
	);

	const data = () => embedData();
	const hasContent = () =>
		!!data() && !!(data()!.title || data()!.description || data()!.image);
	const isThumbnail = () => !!data()?.image && data()!.largeImage === false;
	const imageUrl = () => {
		const img = data()?.image?.[0];
		return img ? resolveEmbedImage(img.url) : undefined;
	};
	const imageAlt = () => data()?.image?.[0]?.alt || "";

	return (
		<div ref={stableMedia}>
			<Show when={hasContent()}>
				<div
					class="flex flex-col border-l-4 pl-3 pr-4 py-2 bg-card mb-2 rounded-r-md max-w-104"
					style={{ "border-color": data()!.themeColor || "var(--border)" }}
				>
					<div
						class="flex gap-3"
						classList={{
							"flex-row items-start": isThumbnail(),
							"flex-col": !isThumbnail(),
						}}
					>
						<div class="flex flex-col min-w-0 flex-1">
							<Show when={data()!.siteName}>
								<span class="text-xs text-card-foreground/70">
									{data()!.siteName}
								</span>
							</Show>
							<Show when={data()!.title}>
								<a
									class="font-semibold w-fit text-(--primary-hover)! decoration-(--primary-hover) hover:underline"
									href={props.uri}
									target="_blank"
									rel="noreferrer"
								>
									{data()!.title}
								</a>
							</Show>
							<Show when={data()!.description}>
								<span class="font-light text-card-foreground text-sm mt-0.5">
									{data()!.description}
								</span>
							</Show>
						</div>
						<Show when={isThumbnail() && imageUrl()}>
							<Lightbox src={imageUrl()!}>
								<img
									width={64}
									height={64}
									class="w-16 h-16 object-cover rounded-sm bg-muted shrink-0 cursor-pointer"
									src={imageUrl()}
									alt={imageAlt()}
								/>
							</Lightbox>
						</Show>
					</div>
					<Show when={!isThumbnail() && imageUrl()}>
						<Lightbox src={imageUrl()!}>
							<img
								class="w-full h-auto rounded-sm mt-2 bg-muted border-none cursor-pointer"
								src={imageUrl()}
								alt={imageAlt()}
							/>
						</Lightbox>
					</Show>
				</div>
			</Show>
		</div>
	);
};
