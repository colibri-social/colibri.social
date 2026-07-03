import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import {
	isChannel,
	isMember,
	isTimeShortcut,
	MentionList,
} from "./MentionList";
import { TimePicker } from "./TimePicker";
import { displayableNameFn } from "../../user/DisplayableName";
import { resolveBlob } from "../../../../atproto/resolve-blob";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";

export type EmojiSuggestionData = { name: string; emoji: string };
/**
 * Sentinel item appended to the `@` list. Selecting it doesn't insert a
 * mention — it swaps the popup over to the timestamp picker.
 */
export type TimeShortcut = { timeShortcut: true };
export type SuggestionItem =
	| Member
	| Channel
	| EmojiSuggestionData
	| TimeShortcut;

type Command = (item: SuggestionItem) => void;

export function selectItem(
	items: SuggestionItem[],
	command: Command,
	index: number,
) {
	const item = items[index];
	if (!item) return;

	// The time shortcut is handled upstream (it opens the picker rather than
	// inserting anything); guard here so it's never treated as an emoji.
	if (isTimeShortcut(item)) return;

	if (isMember(item)) {
		command({
			id: item.did,
			label: displayableNameFn(item),
			handle: item.handle.replaceAll("at://", ""),
			avatar: resolveBlob(item.did, item.data.avatar),
			type: "member",
		} as any);
	} else if (isChannel(item)) {
		command({
			id: item.uri,
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

export const createMentionRenderer = (
	char: "@" | "#" | ":",
	mainEditor?: boolean,
) => {
	return () => {
		const [selectedIndex, setSelectedIndex] = createSignal(0);

		let container: HTMLDivElement | null = null;
		let dispose: (() => void) | null = null;
		let currentProps: SuggestionProps | null = null;
		let currentItems: SuggestionItem[] = [];
		let currentCommand: Command | null = null;
		// Once the user picks the `@time` shortcut the popup swaps to the picker
		// and stays there until the suggestion exits. Reset on each new trigger.
		let showTimePicker = false;

		const position = (props: SuggestionProps) => {
			if (!container) return;

			if (mainEditor) {
				const chatInputContainer = document.querySelector<HTMLDivElement>(
					".chat-input-container",
				)!;
				const parentContainerRect = chatInputContainer.getBoundingClientRect();

				container.style.left = `${parentContainerRect.left + 8}px`;
				container.style.top = `${parentContainerRect.top - 8}px`;
				container.style.width = `${parentContainerRect.width - 16}px`;
				container.style.transform = "translateY(calc(-100%))";
			} else if (props.clientRect) {
				const rect = props.clientRect();

				if (rect) {
					container.style.minWidth = `400px`;
					container.style.left = `${rect.left + window.scrollX}px`;
					container.style.top = `${rect.top + window.scrollY}px`;
					container.style.transform = "translateY(calc(-100% - 4px))";
				}
			}
		};

		// Routes a selection: the time shortcut swaps the popup to the picker,
		// everything else inserts a mention as usual.
		const handleSelect = (
			items: SuggestionItem[],
			command: Command,
			index: number,
		) => {
			const item = items[index];
			if (item && isTimeShortcut(item)) {
				showTimePicker = true;
				mount();
				return;
			}
			selectItem(items, command, index);
		};

		const mount = () => {
			if (!container || !currentProps) return;
			const props = currentProps;

			// The emoji popup stays hidden until the query is long enough to be
			// worth searching; the mention list and picker always show.
			container.style.display =
				char === ":" && props.query.length < 2 ? "none" : "block";

			if (dispose) dispose();
			dispose = render(
				() =>
					showTimePicker ? (
						<TimePicker
							editor={props.editor}
							range={props.range}
							command={props.command as (attrs: any) => void}
						/>
					) : (
						<MentionList
							items={props.items as SuggestionItem[]}
							char={char}
							command={props.command}
							selectItem={handleSelect}
							selectedIndex={selectedIndex}
							setSelectedIndex={setSelectedIndex}
						/>
					),
				container,
			);
		};

		return {
			onStart(props: SuggestionProps) {
				currentProps = props;
				currentItems = props.items;
				currentCommand = props.command;
				showTimePicker = false;

				container = document.createElement("div");
				container.style.cssText =
					"position: absolute; z-index: 9999; pointer-events: auto;";

				document.body.appendChild(container);

				position(props);
				mount();
			},

			onUpdate(props: SuggestionProps) {
				if (!container) return;

				currentProps = props;
				currentItems = props.items;
				currentCommand = props.command;

				position(props);
				mount();
			},

			onKeyDown(props: SuggestionKeyDownProps): boolean {
				// While the time picker is open the editor is blurred and the
				// picker handles its own keys, so the suggestion shouldn't.
				if (showTimePicker) return false;

				if (!currentCommand || !currentItems || currentItems.length === 0)
					return false;

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
				if (props.event.key === "Enter" || props.event.key === "Tab") {
					handleSelect(currentItems, currentCommand, selectedIndex());
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
				showTimePicker = false;
				currentProps = null;
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
