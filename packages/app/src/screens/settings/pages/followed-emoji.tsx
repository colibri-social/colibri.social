import { classifyThrown, createLogger } from "@colibri-social/lib";
import { AnimatedImage, Button, ListGroup, toast } from "@colibri-social/ui";
import { UnlinkIcon } from "@solar-icons/solid/bold/unlink";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { EmojiFollowView } from "../../../data/emoji";
import { emojiOwnerName } from "../../../data/emoji-store";
import type { DataStore } from "../../../data/store";

const log = createLogger("followed-emoji");

export const FOLLOWED_EMOJI_COPY = {
	packs: "Followed packs",
	emoji: "Followed emoji",
	remove: "Remove",
	removeFailed: "Couldn't remove it. Try again.",
	missingPack: "Deleted pack",
	missingEmoji: "Deleted emoji",
	unreachablePack: "Pack unavailable",
	unreachableEmoji: "Emoji unavailable",
	missing: "Its owner deleted it.",
	unreachable: "It can't be loaded right now.",
} as const;

const titleOf = (follow: EmojiFollowView) => {
	if (follow.state === "available") {
		if (follow.kind === "pack") return follow.pack?.name ?? "";
		const emoji = follow.emojis[0];
		return emoji ? `:${emoji.name}:` : "";
	}
	if (follow.state === "missing")
		return follow.kind === "pack"
			? FOLLOWED_EMOJI_COPY.missingPack
			: FOLLOWED_EMOJI_COPY.missingEmoji;
	return follow.kind === "pack"
		? FOLLOWED_EMOJI_COPY.unreachablePack
		: FOLLOWED_EMOJI_COPY.unreachableEmoji;
};

const detailOf = (follow: EmojiFollowView) => {
	if (follow.state === "missing") return FOLLOWED_EMOJI_COPY.missing;
	if (follow.state === "unreachable") return FOLLOWED_EMOJI_COPY.unreachable;
	const owner = `by ${emojiOwnerName(follow.owner)}`;
	if (follow.kind !== "pack") return owner;
	return `${owner} · ${follow.emojis.length} emoji`;
};

const FollowRow = (props: { data: DataStore; follow: EmojiFollowView }) => {
	const [busy, setBusy] = createSignal(false);
	const title = () => titleOf(props.follow);
	const preview = () =>
		props.follow.state === "available" ? props.follow.emojis.slice(0, 3) : [];
	const single = () => props.follow.kind === "emoji";
	const previewSize = () => (single() ? 32 : 18);
	const previewClass = () => (single() ? "size-8" : "size-[18px]");
	const remove = async () => {
		setBusy(true);
		try {
			await props.data.emoji.unfollow(props.follow.subject);
		} catch (error) {
			log.warn("removing a follow failed", {
				code: classifyThrown(error, { method: "emoji.putFollow" }).code,
			});
			toast.error(FOLLOWED_EMOJI_COPY.removeFailed);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div
			data-emoji-follow={props.follow.subject}
			data-follow-state={props.follow.state}
			class="flex min-h-14 w-full items-center gap-3 px-3 py-2"
		>
			<span
				aria-hidden="true"
				class="flex h-8 w-14 shrink-0 items-center justify-center gap-0.5 text-muted-foreground [&>svg]:size-6"
			>
				<Show when={preview().length > 0} fallback={<UnlinkIcon />}>
					<For each={preview()}>
						{(emoji) => (
							<AnimatedImage
								src={emoji.image}
								alt=""
								width={previewSize()}
								height={previewSize()}
								class={`shrink-0 object-contain ${previewClass()}`}
							/>
						)}
					</For>
				</Show>
			</span>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-sm leading-5 font-semibold">{title()}</span>
				<span class="truncate text-xs leading-4 text-muted-foreground">
					{detailOf(props.follow)}
				</span>
			</span>
			<Button
				variant="secondary"
				class="h-8 px-3 text-xs"
				aria-label={`${FOLLOWED_EMOJI_COPY.remove} ${title()}`}
				loading={busy()}
				onClick={() => void remove()}
			>
				{FOLLOWED_EMOJI_COPY.remove}
			</Button>
		</div>
	);
};

export const FollowedEmoji = (props: {
	data: DataStore;
	matches: (follow: EmojiFollowView) => boolean;
}) => {
	const follows = createMemo(() =>
		props.data.emoji.follows().filter(props.matches),
	);
	const packs = () => follows().filter((follow) => follow.kind === "pack");
	const singles = () => follows().filter((follow) => follow.kind === "emoji");
	return (
		<>
			<Show when={packs().length > 0}>
				<ListGroup label={FOLLOWED_EMOJI_COPY.packs}>
					<For each={packs()}>
						{(follow) => <FollowRow data={props.data} follow={follow} />}
					</For>
				</ListGroup>
			</Show>
			<Show when={singles().length > 0}>
				<ListGroup label={FOLLOWED_EMOJI_COPY.emoji}>
					<For each={singles()}>
						{(follow) => <FollowRow data={props.data} follow={follow} />}
					</For>
				</ListGroup>
			</Show>
		</>
	);
};
