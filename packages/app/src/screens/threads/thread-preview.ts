import type {
	ChannelPreviewEmoji,
	ThreadLastMessage,
} from "@colibri-social/ui";
import { displayNameOf, summaryAuthor } from "../../data/adapters/display-name";
import { type ChannelSummary, summaryParts } from "../../data/channel-summary";
import { threadSummary } from "../../data/thread-summary";
import type {
	Did,
	Facet,
	MemberView,
	ProfileView,
	ThreadView,
} from "../../data/types";

type PreviewEmoji = {
	name: string;
	src: string;
	alt?: string;
	pending?: boolean;
};

export type ThreadPreviewSources = {
	viewer: Pick<ProfileView, "did" | "displayName" | "handle" | "avatar">;
	member: (did: Did) => MemberView | undefined;
	live: (thread: ThreadView) => ChannelSummary | undefined;
	emoji: (feature: Facet["features"][number]) => PreviewEmoji | undefined;
	isBlocked?: (did: Did) => boolean;
	rewriteUrl?: (uri: string) => string;
};

const previewEmoji = (
	emoji: PreviewEmoji | undefined,
): ChannelPreviewEmoji | undefined =>
	emoji?.pending
		? { name: emoji.name, src: "", pending: true }
		: emoji?.src
			? {
					name: emoji.name,
					src: emoji.src,
					...(emoji.alt ? { alt: emoji.alt } : {}),
				}
			: undefined;

export const threadPreview = (
	thread: ThreadView,
	sources: ThreadPreviewSources,
): ThreadLastMessage | undefined => {
	const summary = threadSummary(thread, sources.live(thread));
	if (!summary) return undefined;
	const own = summary.author === sources.viewer.did;
	const author = own
		? undefined
		: summaryAuthor(summary.authorProfile, sources.member(summary.author));
	const name = author ? author.name : displayNameOf(sources.viewer);
	const avatarSrc = author ? author.avatarSrc : sources.viewer.avatar;

	if (!own && sources.isBlocked?.(summary.author)) {
		return { name: "", text: "", blocked: true };
	}

	return {
		name,
		...(avatarSrc ? { avatarSrc } : {}),
		text: summary.text,
		parts: summaryParts(
			summary,
			(feature) => previewEmoji(sources.emoji(feature)),
			sources.rewriteUrl,
		),
		...(summary.attachment ? { attachment: summary.attachment } : {}),
	};
};
