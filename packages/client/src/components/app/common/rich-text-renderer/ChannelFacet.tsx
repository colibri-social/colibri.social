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
import { communityUriToUrlCompatible } from "../../../../atproto/community-uri-to-url-compatible";
import { useCommunityContext } from "../../../../contexts/Community";
import { useUserContext } from "../../../../contexts/User";
import { getAppViewDid } from "../../../../utils/appview";
import { AtURI } from "../../../../utils/at-uri";
import { parseEmojiText } from "../../../../utils/emoji";
import { purify } from "../../../../utils/purify";
import { CommunityAvatar } from "../../community/CommunityAvatar";
import { NoCommunityAccessModal } from "../../community/NoCommunityAccessModal";
import {
	CHIP_AVATAR_CLASS,
	CHIP_GLYPH_CLASS,
	CHIP_INITIALS_CLASS,
} from "../channel-chip";

const CHANNEL_CLASS =
	"bg-blue-500/25 hover:bg-blue-500/35 px-1 rounded-xs cursor-pointer inline no-underline text-foreground";

const UNRESOLVED_CLASS = "bg-blue-500/25 px-1 rounded-xs inline";

const LOCKED_CLASS =
	"bg-muted-foreground/15 hover:bg-muted-foreground/25 px-1 rounded-xs cursor-pointer inline no-underline text-muted-foreground";

const didOf = (uri: string): string => AtURI.parseAtURI(uri).did ?? "";

export const ChannelFacet: Component<{ channel: string; text: string }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [modalMounted, setModalMounted] = createSignal(false);
	const [modalOpen, setModalOpen] = createSignal(false);

	const channelDid = createMemo(() => didOf(props.channel));

	const isCurrentCommunity = createMemo(
		() => channelDid() === didOf(community().community.uri),
	);

	const localChannel = createMemo(() =>
		community().channels.find((channel) => channel.uri === props.channel),
	);

	const foreignCommunity = createMemo(() => {
		const did = channelDid();
		if (!did || isCurrentCommunity()) return undefined;

		const matches = user.communities.filter(
			(entry) => didOf(entry.uri) === did,
		);
		return matches.find((entry) => entry.uri.endsWith("/self")) ?? matches[0];
	});

	const [foreignChannel] = createResource(
		() => foreignCommunity()?.uri,
		async (uri) => {
			await loadCommunityChannels(
				user.xrpc,
				uri,
				namespace(getAppViewDid(), user.did),
			);
			return peekChannel(props.channel);
		},
	);

	const label = () => parseEmojiText(purify(props.text));

	const foreignHref = () => {
		const target = foreignCommunity();
		if (!target) return "";

		const resolved = foreignChannel();
		if (!resolved) {
			return `/app/c/${communityUriToUrlCompatible(target.uri)}`;
		}

		return buildChannelPath({
			communityUri: target.uri,
			channelType: resolved.type,
			channelRkey: AtURI.parseAtURI(resolved.uri).identifier,
		});
	};

	const localHref = () => {
		const resolved = localChannel();
		if (!resolved) return "";

		return buildChannelPath({
			communityUri: community().community.uri,
			channelType: resolved.type,
			channelRkey: AtURI.parseAtURI(resolved.uri).identifier,
		});
	};

	const openModal = () => {
		setModalMounted(true);
		setModalOpen(true);
	};

	return (
		<Switch
			fallback={
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
			}
		>
			<Match when={localChannel()}>
				{(resolved) => (
					<A
						data-facet-type="channel"
						data-channel={props.channel}
						href={localHref()}
						class={CHANNEL_CLASS}
						innerHTML={parseEmojiText(purify(`#${resolved().name}`))}
					/>
				)}
			</Match>
			<Match when={foreignCommunity()}>
				{(target) => (
					<A
						data-facet-type="channel"
						data-channel={props.channel}
						href={foreignHref()}
						title={target().name}
						class={CHANNEL_CLASS}
					>
						<CommunityAvatar
							community={target()}
							variant="small"
							class={CHIP_AVATAR_CLASS}
							fallbackClass={CHIP_INITIALS_CLASS}
						/>
						<CaretRightIcon class={CHIP_GLYPH_CLASS} />
						<Show
							when={foreignChannel()}
							fallback={<span innerHTML={label()} />}
						>
							{(resolved) => (
								<span
									innerHTML={parseEmojiText(purify(`#${resolved().name}`))}
								/>
							)}
						</Show>
					</A>
				)}
			</Match>
			<Match when={isCurrentCommunity()}>
				<span
					data-facet-type="channel"
					data-channel={props.channel}
					class={UNRESOLVED_CLASS}
					innerHTML={label()}
				/>
			</Match>
		</Switch>
	);
};
