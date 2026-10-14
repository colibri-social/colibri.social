import {
	CustomEmojiDrawer,
	type RichTextCustomEmoji,
	toast,
} from "@colibri-social/ui";
import { createMemo, createSignal, Show } from "solid-js";
import {
	type EmojiCatalogView,
	followedCopy,
	followedPack,
	repoOfUri,
	sourceOf,
} from "../../../data/emoji";
import { FOLLOWED_EMOJI_LABEL } from "../../../data/emoji-store";
import type { DataStore } from "../../../data/store";
import type { Did } from "../../../data/types";
import { usePlatform } from "../../../screen/platform";

export const createCustomEmojiDrawer = (options: {
	data: DataStore;
	community: () => Did | undefined;
}) => {
	const { data } = options;
	const [target, setTarget] = createSignal<RichTextCustomEmoji>();
	const [open, setOpen] = createSignal(false);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const platform = usePlatform();

	const knownOwner = (did: Did) =>
		did === data.viewer.did ||
		(data.communities.value() ?? []).some((entry) => entry.did === did);

	const catalogFor = (did: Did): EmojiCatalogView | undefined =>
		knownOwner(did) ? data.emoji.catalog(did).value() : undefined;

	const details = createMemo(() => {
		const current = target();
		if (!current?.id) return undefined;
		const followed = data.emoji.followed().value();
		const emoji =
			data.emoji.lookup(current.id) ??
			catalogFor(repoOfUri(current.id))?.emojis.find(
				(entry) => entry.id === current.id,
			);
		const source = emoji ? sourceOf(emoji) : current.id;
		const owner = repoOfUri(source);
		const ownerCatalog = catalogFor(owner);
		const pack = ownerCatalog?.packs.find((entry) =>
			entry.emojis.includes(source),
		);
		const space = (data.communities.value() ?? []).find(
			(entry) => entry.did === owner,
		);
		return {
			source,
			owner,
			own: owner === data.viewer.did,
			sourceLabel:
				owner === data.viewer.did ? FOLLOWED_EMOJI_LABEL : space?.name,
			pack,
			followed: !!followedCopy(followed, source),
			packFollowed: pack ? !!followedPack(followed, pack) : false,
		};
	});

	const fail = (message: string) => (error: unknown) => {
		toast.error(message);
		throw error;
	};

	const Overlay = () => (
		<Show when={target()}>
			{(emoji) => (
				<CustomEmojiDrawer
					platform={platform()}
					anchorElement={anchor()}
					open={open()}
					onOpenChange={setOpen}
					name={emoji().name}
					src={emoji().src}
					alt={emoji().alt}
					source={details()?.sourceLabel}
					packName={details()?.pack?.name}
					followed={details()?.followed}
					packFollowed={details()?.packFollowed}
					onFollowChange={
						details() && !details()?.own
							? async (follow) => {
									const source = details()?.source;
									if (!source) return;
									await (follow
										? data.emoji.follow(source)
										: data.emoji.unfollow(source)
									).catch(fail("Couldn't update your emoji"));
								}
							: undefined
					}
					onPackFollowChange={
						details()?.pack && !details()?.own
							? async (follow) => {
									const current = details();
									if (!current?.pack) return;
									await (follow
										? data.emoji.followPack(current.owner, current.pack.id)
										: data.emoji.unfollowPack(current.owner, current.pack.id)
									).catch(fail("Couldn't update your emoji"));
								}
							: undefined
					}
				/>
			)}
		</Show>
	);

	return {
		open: (emoji: RichTextCustomEmoji, element?: HTMLElement) => {
			setAnchor(element);
			setTarget(emoji);
			setOpen(true);
			void data.emoji.followed();
			if (emoji.id) {
				const owner = repoOfUri(emoji.id);
				if (knownOwner(owner)) void data.emoji.catalog(owner);
			}
		},
		Overlay,
	};
};
