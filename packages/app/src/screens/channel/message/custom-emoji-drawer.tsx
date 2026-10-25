import {
	CustomEmojiDrawer,
	type RichTextCustomEmoji,
	toast,
} from "@colibri-social/ui";
import { createMemo, createSignal, Show } from "solid-js";
import { repoOfUri } from "../../../data/emoji";
import {
	createFetchedOwner,
	knownOwner,
} from "../../../data/emoji/pack-preview";
import { emojiOwnerName, OWN_EMOJI_LABEL } from "../../../data/emoji-store";
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
	const [opens, setOpens] = createSignal(0);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const platform = usePlatform();

	const details = createMemo(() => {
		const current = target();
		if (!current?.id) return undefined;
		const source = current.id;
		const owner = repoOfUri(source);
		const packFollow = data.emoji.packFollowOf(source);
		const pack =
			data.emoji
				.ownerCatalog(source)
				?.value()
				?.packs.find((entry) => entry.emojis.includes(source)) ??
			packFollow?.pack;
		const direct = data.emoji.followOf(source);
		const space = (data.communities.value() ?? []).find(
			(entry) => entry.did === owner,
		);
		const followOwner = (direct ?? packFollow)?.owner;
		const own = owner === data.viewer.did;
		return {
			source,
			own,
			sourceLabel: own
				? pack
					? undefined
					: OWN_EMOJI_LABEL
				: (space?.name ??
					(followOwner ? emojiOwnerName(followOwner) : undefined)),
			pack,
			coveredByPack: !direct && !!packFollow,
			followed: !!direct || !!packFollow,
			packFollowed: pack ? !!data.emoji.followOf(pack.id) : false,
		};
	});

	const ownerDid = createMemo(() => {
		const source = target()?.id;
		return source ? repoOfUri(source) || undefined : undefined;
	});
	const fetchedOwner = createFetchedOwner(data, () => {
		opens();
		const did = ownerDid();
		return did && !knownOwner(data, did) ? did : undefined;
	});
	const ownerHandle = () => {
		const did = ownerDid();
		if (!did) return undefined;
		const owner = knownOwner(data, did) ?? fetchedOwner();
		return owner?.did === did && owner.handle ? owner.handle : undefined;
	};

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
					handle={ownerHandle()}
					packName={details()?.pack?.name}
					followed={details()?.followed}
					packFollowed={details()?.packFollowed}
					onFollowChange={
						details() && !details()?.own && !details()?.coveredByPack
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
									const pack = details()?.pack;
									if (!pack) return;
									await (follow
										? data.emoji.follow(pack.id)
										: data.emoji.unfollow(pack.id)
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
			setOpens((count) => count + 1);
			void data.emoji.library();
			if (emoji.id) void data.emoji.ownerCatalog(emoji.id);
		},
		Overlay,
	};
};
