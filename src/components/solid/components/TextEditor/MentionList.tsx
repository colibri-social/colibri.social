import {
	type Accessor,
	type Component,
	createEffect,
	For,
	type Setter,
	Show,
} from "solid-js";
import type { ChannelData } from "@/utils/sdk";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import type { MemberData } from "../../layouts/CommunityLayout";
import type { SuggestionItem, selectItem } from "./MentionPopupRenderer";

export function isMember(item: SuggestionItem): item is MemberData {
	return "member_did" in item;
}

export const MentionList: Component<{
	items: SuggestionItem[];
	char: "@" | "#";
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

	return (
		<div class="flex flex-col border border-border bg-card rounded-md drop-shadow-black drop-shadow-sm overflow-hidden">
			<Show
				when={props.items.length > 0}
				fallback={
					<div class="text-muted-foreground mx-2">
						No {props.char === "@" ? "members" : "channels"} found
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
							<Show
								when={isMember(item)}
								fallback={
									<>
										<span>
											<ChatCircleDots size={20} />
										</span>
										<span>{(item as ChannelData).name}</span>
									</>
								}
							>
								{/* Member row */}
								<span class="relative">
									<img
										class="w-6 h-6 rounded-full"
										src={(item as MemberData).avatar_url}
										alt={(item as MemberData).display_name}
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
										{(item as MemberData).display_name}
									</span>
								</span>
							</Show>
						</button>
					)}
				</For>
			</Show>
		</div>
	);
};
