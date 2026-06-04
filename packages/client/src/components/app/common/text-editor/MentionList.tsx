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
import type {
	EmojiSuggestionData,
	SuggestionItem,
	selectItem,
} from "./MentionPopupRenderer";
import User from "../../user";
import { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import SpeakerLowIcon from "~icons/ph/speaker-low";
import ChatsIcon from "~icons/ph/chats";

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

	return (
		<div class="flex flex-col border border-border bg-card rounded-md drop-shadow-black drop-shadow-sm overflow-hidden">
			<Show
				when={props.items.length > 0}
				fallback={
					<div class="text-muted-foreground mx-2">
						No {emptyPopupStr()} found
					</div>
				}
			>
				<For each={props.items}>
					{(item, index) => (
						<button
							class={`flex flex-row gap-1.5 items-center px-2 py-1`}
							classList={{
								"bg-muted": index() === props.selectedIndex(),
							}}
							onClick={() =>
								props.selectItem(props.items, props.command, index())
							}
							onMouseEnter={() => props.setSelectedIndex(index())}
							type="button"
						>
							<Switch>
								<Match when={isMember(item)}>
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
										<span class="mention-popup-name">
											{(item as Member).data.displayName ||
												(item as Member).handle}
										</span>
									</span>
								</Match>
								<Match when={isChannel(item)}>
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
									<span>{(item as Channel).name}</span>
								</Match>
								<Match when={isEmoji}>
									<span
										innerHTML={twemoji.parse(
											(item as EmojiSuggestionData).emoji,
										)}
										class="[&>img]:w-5 [&>img]:h-5"
									/>
									<span>{(item as EmojiSuggestionData).name}</span>
								</Match>
							</Switch>
						</button>
					)}
				</For>
			</Show>
		</div>
	);
};
