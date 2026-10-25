import type {
	ChannelPreviewEmoji,
	ThreadLastMessage,
} from "@colibri-social/ui";
import { displayNameOf } from "../../data/adapters/display-name";
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
	const member = own ? undefined : sources.member(summary.author);
	const name = own
		? displayNameOf(sources.viewer)
		: member
			? displayNameOf(member.actor, member)
			: "Someone";
	const avatarSrc = own ? sources.viewer.avatar : member?.actor.avatar;
	return {
		name,
		...(avatarSrc ? { avatarSrc } : {}),
		text: summary.text,
		parts: summaryParts(summary, (feature) =>
			previewEmoji(sources.emoji(feature)),
		),
		...(summary.attachment ? { attachment: summary.attachment } : {}),
	};
};
