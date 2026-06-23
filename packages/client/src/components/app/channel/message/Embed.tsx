import { type Component, createResource, Show } from "solid-js";
import { useStableMedia } from "../../../../contexts/ScrollAnchor";
import { Lightbox } from "../../common/Lightbox";

type EmbedData = {
	title?: string;
	description?: string;
	siteName?: string;
	themeColor?: string;
	image?: Array<{ url: string; alt?: string }>;
};

const fetchEmbedData = async (uri: string): Promise<EmbedData | undefined> => {
	try {
		// Proxy through allorigins to avoid CORS restrictions, with a 5s timeout.
		const res = await fetch(
			`https://api.allorigins.win/get?url=${encodeURIComponent(uri)}`,
			{ signal: AbortSignal.timeout(5000) },
		);
		if (!res.ok) return undefined;
		const json = await res.json();
		const html: string = json.contents;
		if (!html) return undefined;

		const doc = new DOMParser().parseFromString(html, "text/html");

		const getMeta = (...names: string[]): string | undefined => {
			for (const name of names) {
				const val =
					doc
						.querySelector(`meta[property="${name}"]`)
						?.getAttribute("content") ??
					doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
				if (val) return val;
			}
			return undefined;
		};

		const title =
			getMeta("og:title", "twitter:title") ??
			doc.querySelector("title")?.textContent?.trim() ??
			undefined;
		const description = getMeta(
			"og:description",
			"twitter:description",
			"description",
		);
		const siteName = getMeta("og:site_name") ?? new URL(uri).hostname;
		const themeColor = getMeta("theme-color");
		const imageUrl = getMeta("og:image", "twitter:image");

		if (!title && !description) return undefined;

		return {
			title: title || undefined,
			description: description || undefined,
			siteName,
			themeColor: themeColor || undefined,
			image: imageUrl ? [{ url: imageUrl }] : undefined,
		};
	} catch {
		return undefined;
	}
};

export const Embed: Component<{ uri: string }> = (props) => {
	const [embedData] = createResource(props.uri, fetchEmbedData);
	const stableMedia = useStableMedia();

	return (
		<Show
			when={embedData() && (embedData()!.title || embedData()!.description)}
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
									ref={stableMedia}
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
