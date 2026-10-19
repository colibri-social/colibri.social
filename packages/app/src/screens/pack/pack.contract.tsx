import {
	EmojiPackCardUnavailable,
	EmojiPackFollow,
	EmojiPackGrid,
	emojiPackShareUrl,
	emojiPackSummary,
	NavHeader,
	Skeleton,
} from "@colibri-social/ui";
import { createMemo, For, Match, Show, Switch } from "solid-js";
import { usePackPreview } from "../../data/emoji/pack-preview";
import type { PackTarget } from "../../data/emoji/shared-pack";
import type { Did } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { usePlatform } from "../../screen/platform";
import { useStack } from "../../shell/stack";

export type PackArgs = { did: string; rkey: string };

export const PACK_COPY = {
	title: "Emoji pack",
} as const;

const SKELETON_TILES = 12;

export const pack = defineContract({
	id: "pack",
	model: (args: PackArgs) => {
		const stack = useStack();
		const platform = usePlatform();
		const target = createMemo((): PackTarget | undefined =>
			args.did.startsWith("did:") && args.rkey
				? { did: args.did as Did, rkey: args.rkey }
				: undefined,
		);
		const preview = usePackPreview(target);
		const current = () =>
			preview.state() === "ready" ? preview.pack() : undefined;
		return {
			platform,
			preview,
			current,
			title: () => current()?.name ?? PACK_COPY.title,
			summary: () => {
				const loaded = current();
				return loaded ? emojiPackSummary(loaded) : undefined;
			},
			canFollow: () => !!current() && !preview.own(),
			url: () => emojiPackShareUrl({ did: args.did, rkey: args.rkey }),
			leave: () => (stack.pop() ? undefined : stack.setRoot({ tab: "spaces" })),
		};
	},
	slots: {
		Header: slot((m) => (
			<NavHeader safeTop kind="back" onNavigate={m.leave} title={m.title()} />
		)),
		Summary: slot((m) => (
			<Show when={m.summary()}>
				{(summary) => (
					<p
						data-pack-summary=""
						class="m-0 text-sm leading-prose text-muted-foreground"
					>
						{summary()}
					</p>
				)}
			</Show>
		)),
		Body: slot((m) => (
			<div data-pack-screen="" class="flex flex-col">
				<Switch>
					<Match when={m.preview.state() === "loading"}>
						<ul
							data-pack-loading=""
							class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1 p-0"
						>
							<For each={Array.from({ length: SKELETON_TILES })}>
								{() => (
									<li class="flex flex-col items-center gap-1.5 px-1 py-2">
										<Skeleton width={40} height={40} />
										<Skeleton width={48} height={12} />
									</li>
								)}
							</For>
						</ul>
					</Match>
					<Match when={m.preview.state() === "failed"}>
						<EmojiPackCardUnavailable
							reason="failed"
							onRetry={m.preview.retry}
							class="self-center"
						/>
					</Match>
					<Match when={m.preview.state() === "missing"}>
						<EmojiPackCardUnavailable reason="missing" class="self-center" />
					</Match>
					<Match when={m.current()}>
						{(current) => (
							<div data-emoji-pack-view-all="" data-platform={m.platform()}>
								<EmojiPackGrid emojis={current().emojis} />
							</div>
						)}
					</Match>
				</Switch>
			</div>
		)),
		Footer: slot((m) => (
			<Show when={m.canFollow()}>
				<EmojiPackFollow
					own={m.preview.own()}
					followed={m.preview.followed()}
					onFollowChange={m.preview.setFollowed}
				/>
			</Show>
		)),
	},
});
