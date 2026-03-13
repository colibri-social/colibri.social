import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import type { ChannelData } from "@/utils/sdk";
import type { MemberData } from "../../layouts/CommunityLayout";
import { isChannel, isMember, MentionList } from "./MentionList";

export type EmojiSuggestionData = { name: string; emoji: string };
export type SuggestionItem = MemberData | ChannelData | EmojiSuggestionData;

type Command = (item: SuggestionItem) => void;

export function selectItem(
	items: SuggestionItem[],
	command: Command,
	index: number,
) {
	const item = items[index];
	if (!item) return;

	if (isMember(item)) {
		command({
			id: item.member_did,
			label: item.display_name,
			handle: item.handle,
			avatar: item.avatar_url,
			type: "member",
		} as any);
	} else if (isChannel(item)) {
		command({
			id: item.rkey,
			label: item.name,
			type: "channel",
		} as any);
	} else {
		command({
			label: item.emoji,
			type: "emoji",
		} as any);
	}
}

export const createMentionRenderer = (char: "@" | "#" | ":") => {
	return () => {
		const [selectedIndex, setSelectedIndex] = createSignal(0);

		let container: HTMLDivElement | null = null;
		let dispose: (() => void) | null = null;
		let currentItems: SuggestionItem[] = [];
		let currentCommand: Command | null = null;

		return {
			onStart(props: SuggestionProps) {
				currentItems = props.items;
				currentCommand = props.command;

				container = document.createElement("div");
				container.style.cssText =
					"position: absolute; z-index: 9999; pointer-events: auto;";
				document.body.appendChild(container);

				// Position above the cursor
				if (props.clientRect) {
					const rect = props.clientRect();
					if (rect) {
						container.style.left = `${rect.left + window.scrollX}px`;
						container.style.top = `${rect.top + window.scrollY}px`;
						container.style.transform = "translateY(calc(-100% - 4px))";
					}
				}

				dispose = render(
					() => (
						<MentionList
							items={props.items as SuggestionItem[]}
							char={char}
							command={props.command}
							selectItem={selectItem}
							selectedIndex={selectedIndex}
							setSelectedIndex={setSelectedIndex}
						/>
					),
					container,
				);
			},

			onUpdate(props: SuggestionProps) {
				if (!container) return;

				currentItems = props.items;
				currentCommand = props.command;

				if (props.clientRect) {
					const rect = props.clientRect();
					if (rect) {
						container.style.left = `${rect.left + window.scrollX}px`;
						container.style.top = `${rect.top + window.scrollY}px`;
						container.style.transform = "translateY(calc(-100% - 4px))";
					}
				}

				// Re-render with updated items, we re-mount to pass new props.
				if (dispose) dispose();
				dispose = render(
					() => (
						<MentionList
							items={props.items as SuggestionItem[]}
							char={char}
							command={props.command}
							selectItem={selectItem}
							selectedIndex={selectedIndex}
							setSelectedIndex={setSelectedIndex}
						/>
					),
					container,
				);
			},

			onKeyDown(props: SuggestionKeyDownProps): boolean {
				if (!currentCommand || !currentItems) return false;

				if (props.event.key === "ArrowUp") {
					setSelectedIndex(
						(i) => (i + currentItems.length - 1) % currentItems.length,
					);
					return true;
				}
				if (props.event.key === "ArrowDown") {
					setSelectedIndex((i) => (i + 1) % currentItems.length);
					return true;
				}
				if (props.event.key === "Enter") {
					selectItem(currentItems, currentCommand, selectedIndex());
					return true;
				}
				if (props.event.key === "Escape") {
					if (dispose) {
						props.event.preventDefault();
						props.event.stopPropagation();
						props.event.stopImmediatePropagation();
						this.onExit();
						return true;
					}
					return false;
				}
				return false;
			},

			onExit() {
				if (dispose) {
					dispose();
					dispose = null;
				}
				if (container) {
					container.remove();
					container = null;
				}
			},
		};
	};
};
