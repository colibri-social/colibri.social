import {
	EmojiPackCard,
	EmojiPackCardSkeleton,
	EmojiPackCardUnavailable,
	emojiPackShareUrl,
	parseEmojiPackShareUrl,
} from "@colibri-social/ui";
import { createMemo, Match, Switch } from "solid-js";
import { usePackPreview } from "../../../data/emoji/pack-preview";
import type { PackTarget } from "../../../data/emoji/shared-pack";
import type { Did } from "../../../data/types";

export const packLinkOf = (uri: string): string | undefined => {
	const target = parseEmojiPackShareUrl(uri);
	return target ? emojiPackShareUrl(target) : undefined;
};

export const PackEmbed = (props: {
	url: string;
	platform: "mobile" | "desktop";
}) => {
	const target = createMemo((): PackTarget | undefined => {
		const parsed = parseEmojiPackShareUrl(props.url);
		return parsed ? { did: parsed.did as Did, rkey: parsed.rkey } : undefined;
	});
	const preview = usePackPreview(target);

	return (
		<div data-pack-embed="" class="flex min-w-0 flex-col">
			<Switch>
				<Match when={preview.state() === "loading"}>
					<EmojiPackCardSkeleton />
				</Match>
				<Match when={preview.state() === "failed"}>
					<EmojiPackCardUnavailable reason="failed" onRetry={preview.retry} />
				</Match>
				<Match when={preview.state() === "missing"}>
					<EmojiPackCardUnavailable reason="missing" />
				</Match>
				<Match when={preview.pack()}>
					{(pack) => (
						<EmojiPackCard
							url={props.url}
							platform={props.platform}
							own={preview.own()}
							followed={preview.followed()}
							onFollowChange={preview.own() ? undefined : preview.setFollowed}
							pack={pack()}
						/>
					)}
				</Match>
			</Switch>
		</div>
	);
};
