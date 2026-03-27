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
import type { ChannelData } from "@/utils/sdk";
import Icon from "../../icons/Icon";
import type { MemberData } from "../../layouts/CommunityLayout";
import type {
	EmojiSuggestionData,
	SuggestionItem,
	selectItem,
} from "./MentionPopupRenderer";

export function isMember(item: SuggestionItem): item is MemberData {
	return "member_did" in item;
}

export function isChannel(item: SuggestionItem): item is ChannelData {
	return "rkey" in item;
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
										<img
											class="w-6 h-6 rounded-full"
											src={
												(item as MemberData).avatar_url ||
												`/user-placeholder.png`
											}
											alt={
												(item as MemberData).display_name ||
												(item as MemberData).handle
											}
											onError={(e) => {
												(e.currentTarget as HTMLImageElement).src =
													`/user-placeholder.png`;
											}}
										/>
										<span
											class="absolute bottom-1 right-1 rounded-full"
											classList={{
												"bg-green-500": (item as MemberData).state === "online",
												"bg-yellow-500": (item as MemberData).state === "away",
												"bg-red-500": (item as MemberData).state === "dnd",
												"bg-neutral-500":
													(item as MemberData).state === "offline",
											}}
										/>
									</span>
									<span class="flex flex-col items-start">
										<span class="mention-popup-name">
											{(item as MemberData).display_name ||
												(item as MemberData).handle}
										</span>
									</span>
								</Match>
								<Match when={isChannel(item)}>
									<span>
										<Switch>
											<Match when={(item as ChannelData).type === "text"}>
												<Icon variant="regular" name="chat-circle-dots-icon" />
											</Match>
											<Match when={(item as ChannelData).type === "voice"}>
												<Icon variant="regular" name="speaker-low-icon" />
											</Match>
											<Match when={(item as ChannelData).type === "voice"}>
												<Icon variant="regular" name="chats-icon" />
											</Match>
										</Switch>
									</span>
									<span>{(item as ChannelData).name}</span>
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
