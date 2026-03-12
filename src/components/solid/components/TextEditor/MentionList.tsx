import {
	createEffect,
	createSignal,
	For,
	onMount,
	Show,
	type Component,
} from "solid-js";
import type { ChannelItem, SuggestionItem } from "./MentionPopupRenderer";
import type { MemberData } from "../../layouts/CommunityLayout";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import "./MentionList.css";

function isMember(item: SuggestionItem): item is MemberData {
	return "member_did" in item;
}

export const MentionList: Component<{
	items: SuggestionItem[];
	char: "@" | "#";
	command: (item: SuggestionItem) => void;
}> = (props) => {
	const [selectedIndex, setSelectedIndex] = createSignal(0);

	// Reset selection when items change
	createEffect(() => {
		props.items; // track
		setSelectedIndex(0);
	});

	function selectItem(index: number) {
		const item = props.items[index];
		if (item) props.command(item);
	}

	function upHandler() {
		setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length);
	}

	function downHandler() {
		setSelectedIndex((i) => (i + 1) % props.items.length);
	}

	function enterHandler() {
		selectItem(selectedIndex());
	}

	let listRef!: HTMLDivElement;

	onMount(() => {
		(listRef as any).__mentionHandlers = {
			upHandler,
			downHandler,
			enterHandler,
		};
	});

	return (
		<div class="mention-popup" ref={listRef}>
			<Show
				when={props.items.length > 0}
				fallback={
					<div class="mention-popup-empty">
						No {props.char === "@" ? "members" : "channels"} found
					</div>
				}
			>
				<For each={props.items}>
					{(item, index) => (
						<button
							class={`mention-popup-item${index() === selectedIndex() ? " selected" : ""}`}
							onClick={() => selectItem(index())}
							onMouseEnter={() => setSelectedIndex(index())}
							type="button"
						>
							<Show
								when={isMember(item)}
								fallback={
									<>
										<span class="mention-popup-channel-icon">
											<ChatCircleDots size={14} />
										</span>
										<span class="mention-popup-name">
											{(item as ChannelItem).name}
										</span>
									</>
								}
							>
								{/* Member row */}
								<span class="mention-popup-avatar-wrap">
									<img
										class="mention-popup-avatar"
										src={(item as MemberData).avatar_url}
										alt={(item as MemberData).display_name}
										onError={(e) => {
											(e.currentTarget as HTMLImageElement).src =
												`/user-placeholder.png`;
										}}
									/>
									<Show when={(item as MemberData).state === "online"}>
										<span class="mention-popup-online-dot" />
									</Show>
								</span>
								<span class="mention-popup-member-info">
									<span class="mention-popup-name">
										{(item as MemberData).display_name}
									</span>
									<Show when={(item as MemberData).handle}>
										<span class="mention-popup-handle">
											@{(item as MemberData).handle}
										</span>
									</Show>
								</span>
							</Show>
						</button>
					)}
				</For>
			</Show>
		</div>
	);
};
