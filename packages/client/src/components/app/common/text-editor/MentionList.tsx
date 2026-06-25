import twemoji from "@twemoji/api";
import {
	type Accessor,
	type Component,
	createEffect,
	For,
	Match,
	type Setter,
	Show,
	Switch,
} from "solid-js";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import ChatsIcon from "~icons/ph/chats";
import SpeakerLowIcon from "~icons/ph/speaker-low";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import User from "../../user";
import type {
	EmojiSuggestionData,
	SuggestionItem,
	selectItem,
} from "./MentionPopupRenderer";
import { displayableNameFn } from "../../user/DisplayableName";

export function isMember(item: SuggestionItem): item is Member {
	return "did" in item;
}

export function isChannel(item: SuggestionItem): item is Channel {
	return "uri" in item;
}

export function isEmoji(item: SuggestionItem): item is EmojiSuggestionData {
	return "emoji" in item;
}

export const MentionList: Component<{
	items: SuggestionItem[];
	char: "@" | "#" | ":";
	command: (item: SuggestionItem) => void;
	selectItem: typeof selectItem;
	selectedIndex: Accessor<number>;
	setSelectedIndex: Setter<number>;
}> = (props) => {
	// Reset selection when items change
	createEffect(() => {
		props.items; // track
		props.setSelectedIndex(0);
	});

	const emptyPopupStr = () => {
		switch (props.char) {
			case "#":
				return "channels";
			case ":":
				return "emojis";
			case "@":
				return "members";
		}
	};

	const sorted: Accessor<SuggestionItem[]> = () =>
		props.items.sort((a, b) => {
			if (isMember(a) && isMember(b)) {
				return displayableNameFn(a).localeCompare(displayableNameFn(b));
			} else if (isChannel(a) && isChannel(b)) {
				return a.name.localeCompare(b.name);
			} else if (isEmoji(a) && isEmoji(b)) {
				return a.name.localeCompare(b.name);
			}

			return 0;
		});

	return (
		<div class="flex flex-col border border-border bg-card rounded-md drop-shadow-black drop-shadow-sm overflow-hidden p-2">
			<Show
				when={sorted().length > 0}
				fallback={
					<div class="text-muted-foreground mx-2">
						No {emptyPopupStr()} found
					</div>
				}
			>
				<span class="text-xs text-muted-foreground mb-2">
					{emptyPopupStr().toUpperCase()}
				</span>
				<For each={sorted()}>
					{(item, index) => (
						<button
							class={`flex flex-row gap-4 items-center justify-between px-2 py-1 rounded-sm`}
							classList={{
								"bg-muted": index() === props.selectedIndex(),
							}}
							onClick={() => props.selectItem(sorted(), props.command, index())}
							onMouseEnter={() => props.setSelectedIndex(index())}
							type="button"
						>
							<Switch>
								<Match when={isMember(item)}>
									<div class="flex flex-row items-center justify-between gap-1.5">
										{/* Note: We cannot use the inline profile here as we don't have access to the community context. */}
										<span class="relative">
											<User.Avatar user={item as Member} size="small" />
											<span
												class="absolute bottom-1 right-1 rounded-full"
												classList={{
													"bg-green-500":
														(item as Member).data.onlineState === "online",
													"bg-yellow-500":
														(item as Member).data.onlineState === "away",
													"bg-red-500":
														(item as Member).data.onlineState === "dnd",
													"bg-neutral-500":
														(item as Member).data.onlineState === "offline",
												}}
											/>
										</span>
										<span class="flex flex-col items-start">
											<span class="text-sm">
												{displayableNameFn(item as Member)}
											</span>
										</span>
									</div>
									<span class="text-sm text-muted-foreground">
										{(item as Member).handle.replaceAll("at://", "") ||
											(item as Member).did}
									</span>
								</Match>
								<Match when={isChannel(item)}>
									<div class="flex flex-row items-center justify-between gap-1.5">
										<span>
											<Switch>
												<Match
													when={
														(item as Channel).type === "text" ||
														"social.colibri.channel.text"
													}
												>
													<ChatCircleDotsIcon />
												</Match>
												<Match
													when={
														(item as Channel).type === "voice" ||
														"social.colibri.channel.voice"
													}
												>
													<SpeakerLowIcon />
												</Match>
												<Match
													when={
														(item as Channel).type === "forum" ||
														"social.colibri.channel.forum"
													}
												>
													<ChatsIcon />
												</Match>
											</Switch>
										</span>
										<span class="text-sm">{(item as Channel).name}</span>
									</div>
								</Match>
								<Match when={isEmoji}>
									<div class="flex flex-row items-center justify-between gap-1.5">
										<span
											innerHTML={twemoji.parse(
												(item as EmojiSuggestionData).emoji,
											)}
											class="[&>img]:w-5 [&>img]:h-5"
										/>
										<span class="text-sm">
											{(item as EmojiSuggestionData).name}
										</span>
									</div>
								</Match>
							</Switch>
						</button>
					)}
				</For>
			</Show>
		</div>
	);
};
