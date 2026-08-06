import type { AT_URI } from "@colibri-social/lib";
import type { Component } from "solid-js";
import { communityUriToUrlCompatible } from "../../../atproto/community-uri-to-url-compatible";
import { useCommunityContext } from "../../../contexts/Community";
import { useEmbedRuntime } from "../../../embed/context";
import { handleExternalLinkClick } from "../../../utils/open-external-link";

const CANONICAL_ORIGIN = "https://colibri.social";

export const OpenInColibriLink: Component<{ href: string }> = (props) => (
	<a
		href={props.href}
		target="_blank"
		rel="noreferrer"
		onClick={handleExternalLinkClick}
		class="w-full shrink-0 border-t border-border px-2 py-2 text-[10px] text-muted-foreground no-underline! hover:text-foreground text-center transition-colors duration-150"
	>
		Open in Colibri
	</a>
);

export const PoweredByColibri = () => {
	const runtime = useEmbedRuntime();
	const community = useCommunityContext();

	if (!runtime) return null;

	const href = () => {
		const uri = community().community.uri as AT_URI<"social.colibri.community">;
		return `${CANONICAL_ORIGIN}/app/c/${communityUriToUrlCompatible(uri)}`;
	};

	return <OpenInColibriLink href={href()} />;
};
