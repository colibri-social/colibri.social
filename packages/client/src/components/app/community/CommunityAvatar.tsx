import type { JsonBlobRef } from "@atproto/lexicon";
import { type Component, Match, Switch } from "solid-js";
import { type BlobVariant, resolveBlob } from "../../../atproto/resolve-blob";
import { AtURI } from "../../../utils/at-uri";
import { cx } from "../../../utils/cva";

export const communityInitials = (name: string): string =>
	name
		.split(" ")
		.map((part) => part.substring(0, 1))
		.join("")
		.substring(0, 3);

export const CommunityAvatar: Component<{
	community: { uri: string; name: string; picture?: JsonBlobRef };
	class?: string;
	fallbackClass?: string;
	textClass?: string;
	variant?: BlobVariant;
}> = (props) => {
	const did = () => AtURI.parseAtURI(props.community.uri).did;

	return (
		<Switch>
			<Match when={props.community.picture}>
				<img
					src={resolveBlob(did(), props.community.picture, props.variant)}
					alt={props.community.name}
					class={cx(
						"rounded-md pointer-events-none select-none object-cover",
						props.class ?? "w-10 h-10",
					)}
				/>
			</Match>
			<Match when={!props.community.picture}>
				<span
					class={cx(
						"flex items-center justify-center text-center",
						props.fallbackClass ?? props.class ?? "w-10 h-10",
					)}
				>
					<span class={cx("font-bold", props.textClass)}>
						{communityInitials(props.community.name)}
					</span>
				</span>
			</Match>
		</Switch>
	);
};
