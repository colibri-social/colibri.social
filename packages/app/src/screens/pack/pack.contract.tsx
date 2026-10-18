import {
	EmojiPackCard,
	EmojiPackCardSkeleton,
	EmojiPackCardUnavailable,
	emojiPackShareUrl,
	NavHeader,
} from "@colibri-social/ui";
import { createMemo, Match, Switch } from "solid-js";
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
		return {
			platform,
			preview,
			url: () => emojiPackShareUrl({ did: args.did, rkey: args.rkey }),
			leave: () => (stack.pop() ? undefined : stack.setRoot({ tab: "spaces" })),
		};
	},
	slots: {
		Header: slot((m) => (
			<NavHeader
				safeTop
				kind="back"
				onNavigate={m.leave}
				title={PACK_COPY.title}
			/>
		)),
		Body: slot((m) => (
			<div data-pack-screen="" class="flex flex-col items-center">
				<Switch>
					<Match when={m.preview.state() === "loading"}>
						<EmojiPackCardSkeleton />
					</Match>
					<Match when={m.preview.state() === "failed"}>
						<EmojiPackCardUnavailable
							reason="failed"
							onRetry={m.preview.retry}
						/>
					</Match>
					<Match when={m.preview.state() === "missing"}>
						<EmojiPackCardUnavailable reason="missing" />
					</Match>
					<Match when={m.preview.pack()}>
						{(current) => (
							<EmojiPackCard
								url={m.url()}
								platform={m.platform()}
								onNavigate={() => {}}
								own={m.preview.own()}
								followed={m.preview.followed()}
								onFollowChange={
									m.preview.own() ? undefined : m.preview.setFollowed
								}
								pack={current()}
							/>
						)}
					</Match>
				</Switch>
			</div>
		)),
	},
});
