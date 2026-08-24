import { A } from "@solidjs/router";
import {
	type Component,
	createMemo,
	createResource,
	createSignal,
	Match,
	Show,
	Switch,
} from "solid-js";
import CaretRightIcon from "~icons/ph/caret-right";
import LockSimpleIcon from "~icons/ph/lock-simple";
import { namespace } from "../../../../atproto/cache/keys";
import {
	loadCommunityChannels,
	peekChannel,
} from "../../../../atproto/channel-reference";
import { buildChannelPath } from "../../../../atproto/colibri-channel-url";
import { parseSpace, spaceSkey } from "../../../../atproto/space-ref";
import { useCommunityContext } from "../../../../contexts/Community";
import { useUserContext } from "../../../../contexts/User";
import { getAppViewDid } from "../../../../utils/appview";
import { ambiguousCategoryName } from "../../../../utils/channel-category";
import { parseEmojiText } from "../../../../utils/emoji";
import { CommunityAvatar } from "../../community/CommunityAvatar";
import { NoCommunityAccessModal } from "../../community/NoCommunityAccessModal";
import {
	CHIP_AVATAR_CLASS,
	CHIP_GLYPH_CLASS,
	CHIP_INITIALS_CLASS,
} from "../channel-chip";

const CHANNEL_CLASS =
	"bg-blue-500/25 hover:bg-blue-500/35 px-1 rounded-xs cursor-pointer inline no-underline text-foreground";

const LOCKED_CLASS =
	"bg-muted-foreground/15 hover:bg-muted-foreground/25 px-1 rounded-xs cursor-pointer inline no-underline text-muted-foreground";

const isLocked = (channel: {
	private?: boolean;
	viewer: { canRead: boolean };
}): boolean => channel.private === true && !channel.viewer.canRead;

export const ChannelFacet: Component<{ channel: string; text: string }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [modalMounted, setModalMounted] = createSignal(false);
	const [modalOpen, setModalOpen] = createSignal(false);

	const targetDid = createMemo(
		() => parseSpace(props.channel)?.authority ?? community().community.did,
	);

	const targetSkey = createMemo(
		() => parseSpace(props.channel)?.skey ?? props.channel,
	);

	const isCurrentCommunity = createMemo(
		() => targetDid() === community().community.did,
	);

	const localChannel = createMemo(() => {
		if (!isCurrentCommunity()) return undefined;

		return community().channels.find(
			(channel) => spaceSkey(channel.space) === targetSkey(),
		);
	});

	const localCategory = createMemo(() => {
		const resolved = localChannel();
		if (!resolved) return undefined;

		return ambiguousCategoryName(
			resolved,
			community().channels,
			community().categories,
		);
	});

	const foreignCommunity = createMemo(() => {
		if (isCurrentCommunity()) return undefined;

		return user.communities.find((entry) => entry.did === targetDid());
	});

	const [foreignChannel] = createResource(
		() => foreignCommunity()?.did,
		async (did) => {
			await loadCommunityChannels(
				user.xrpc,
				did,
				namespace(getAppViewDid(), user.did),
			);
			return peekChannel(props.channel);
		},
	);

	const foreignLocked = createMemo(() => {
		if (foreignChannel.state !== "ready") return false;

		const resolved = foreignChannel();
		return !resolved || isLocked(resolved);
	});

	const label = () => parseEmojiText(props.text);

	const foreignHref = () => {
		const target = foreignCommunity();
		if (!target) return "";

		const resolved = foreignChannel();
		if (!resolved) return `/app/c/${target.did}`;

		return buildChannelPath(resolved.space) ?? `/app/c/${target.did}`;
	};

	const localHref = () => {
		const resolved = localChannel();
		if (!resolved) return "";

		return buildChannelPath(resolved.space) ?? "";
	};

	const openModal = () => {
		setModalMounted(true);
		setModalOpen(true);
	};

	const lockedChip = () => (
		<>
			<span
				data-facet-type="channel"
				data-channel={props.channel}
				class={LOCKED_CLASS}
				onClick={openModal}
			>
				<LockSimpleIcon class={CHIP_GLYPH_CLASS} />
				No access
			</span>
			<Show when={modalMounted()}>
				<NoCommunityAccessModal
					open={modalOpen()}
					onOpenChange={setModalOpen}
				/>
			</Show>
		</>
	);

	return (
		<Switch fallback={lockedChip()}>
			<Match when={localChannel()}>
				{(resolved) => (
					<Show when={!isLocked(resolved())} fallback={lockedChip()}>
						<A
							data-facet-type="channel"
							data-channel={props.channel}
							href={localHref()}
							class={CHANNEL_CLASS}
						>
							<Show when={localCategory()}>
								{(category) => (
									<>
										<span innerHTML={parseEmojiText(category())} />
										<CaretRightIcon class={CHIP_GLYPH_CLASS} />
									</>
								)}
							</Show>
							<span innerHTML={parseEmojiText(`#${resolved().name}`)} />
						</A>
					</Show>
				)}
			</Match>
			<Match when={foreignCommunity()}>
				{(target) => (
					<Show when={!foreignLocked()} fallback={lockedChip()}>
						<A
							data-facet-type="channel"
							data-channel={props.channel}
							href={foreignHref()}
							title={target().name}
							class={CHANNEL_CLASS}
						>
							<CommunityAvatar
								community={target()}
								class={CHIP_AVATAR_CLASS}
								fallbackClass={CHIP_INITIALS_CLASS}
							/>
							<CaretRightIcon class={CHIP_GLYPH_CLASS} />
							<Show
								when={foreignChannel()}
								fallback={<span innerHTML={label()} />}
							>
								{(resolved) => (
									<span innerHTML={parseEmojiText(`#${resolved().name}`)} />
								)}
							</Show>
						</A>
					</Show>
				)}
			</Match>
		</Switch>
	);
};
