import { A } from "@solidjs/router";
import { type Component, createMemo, Show } from "solid-js";
import ArrowElbowUpRightIcon from "~icons/ph/arrow-elbow-up-right";
import CaretRightIcon from "~icons/ph/caret-right";
import LockSimpleIcon from "~icons/ph/lock-simple";
import {
	buildChannelPath,
	buildSpacePath,
	buildThreadPath,
} from "../../../../atproto/colibri-channel-url";
import { spaceAuthority } from "../../../../atproto/space-ref";
import type { ForwardView } from "../../../../atproto/views";
import { useCommunityContext } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { parseEmojiText } from "../../../../utils/emoji";
import {
	CHIP_AVATAR_CLASS,
	CHIP_GLYPH_CLASS,
	CHIP_INITIALS_CLASS,
} from "../../common/channel-chip";
import { RichTextRenderer } from "../../common/rich-text-renderer/RichTextRenderer";
import type { TextWithFacets } from "../../common/rich-text-renderer/util";
import { CommunityAvatar } from "../../community/CommunityAvatar";
import { MessageAttachments } from "./Attachments";
import { MessageTimestamp } from "./MessageTimestamp";

const CHIP_CLASS =
	"inline-flex flex-row items-center gap-1 hover:bg-muted-foreground/20 px-1 rounded-xs cursor-pointer no-underline text-muted-foreground hover:text-foreground w-fit text-xs";

const LOCKED_CHIP_CLASS =
	"inline-flex flex-row items-center gap-1 px-1 rounded-xs text-muted-foreground w-fit text-xs";

export const ForwardedMessage: Component<{
	forward: ForwardView;
	authorDid: string;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const threads = useThreads();

	const space = () => props.forward.source.space;

	const thread = () => threads.bySpace(space());

	const localChannel = () =>
		community().channels.find((channel) => channel.space === space());

	const name = () =>
		props.forward.sourceName ?? thread()?.name ?? localChannel()?.name;

	const sourceCommunity = () =>
		props.forward.sourceCommunity ?? spaceAuthority(space());

	const foreignCommunity = createMemo(() => {
		const did = sourceCommunity();
		if (!did || did === community().community.did) return undefined;
		return user.communities.find((entry) => entry.did === did);
	});

	const href = () => {
		const known = thread();
		if (known) return buildThreadPath(known.channel, space());
		return buildSpacePath(space()) ?? buildChannelPath(space());
	};

	const text = (): TextWithFacets => ({
		text: props.forward.text,
		facets: props.forward.facets ?? [],
	});

	const chipBody = () => (
		<>
			<Show when={name() === undefined}>
				<LockSimpleIcon class={CHIP_GLYPH_CLASS} />
			</Show>
			<Show when={foreignCommunity()}>
				{(entry) => (
					<>
						<CommunityAvatar
							community={entry()}
							class={CHIP_AVATAR_CLASS}
							fallbackClass={CHIP_INITIALS_CLASS}
						/>
						<CaretRightIcon class={CHIP_GLYPH_CLASS} />
					</>
				)}
			</Show>
			<Show when={name()}>
				{(label) => <span innerHTML={parseEmojiText(label())} />}
			</Show>
			<span class="text-muted-foreground">
				<MessageTimestamp datetime={props.forward.createdAt} />
			</span>
		</>
	);

	return (
		<div class="flex flex-col gap-1 border-l-2 border-border pl-2.5 py-0.5 min-w-0">
			<span class="flex flex-row items-center gap-1 text-xs italic text-muted-foreground">
				<ArrowElbowUpRightIcon class="size-3 shrink-0" />
				Forwarded
			</span>
			<Show when={props.forward.text.trim().length > 0}>
				<RichTextRenderer text={text} />
			</Show>
			<Show when={props.forward.attachments.length > 0}>
				<MessageAttachments
					did={props.authorDid}
					attachments={props.forward.attachments}
				/>
			</Show>
			<Show
				when={href()}
				fallback={<span class={LOCKED_CHIP_CLASS}>{chipBody()}</span>}
			>
				{(target) => (
					<A href={target()} class={CHIP_CLASS}>
						{chipBody()}
						<CaretRightIcon class={CHIP_GLYPH_CLASS} />
					</A>
				)}
			</Show>
		</div>
	);
};
