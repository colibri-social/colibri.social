import { render } from "solid-js/web";
import type {
	SuggestionProps,
	SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { MemberData } from "../../layouts/CommunityLayout";
import "./MentionPopup.css";
import { MentionList } from "./MentionList";

export type ChannelItem = { name: string; rkey: string };
export type SuggestionItem = MemberData | ChannelItem;

export const createMentionRenderer = (char: "@" | "#") => {
	return () => {
		let container: HTMLDivElement | null = null;
		let dispose: (() => void) | null = null;
		let listRef: HTMLDivElement | null = null;

		return {
			onStart(props: SuggestionProps) {
				container = document.createElement("div");
				container.style.cssText =
					"position: absolute; z-index: 9999; pointer-events: auto;";
				document.body.appendChild(container);

				// Position aboce the cursor
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
							ref={(el: HTMLDivElement) => {
								listRef = el;
							}}
							items={props.items as SuggestionItem[]}
							char={char}
							command={props.command}
						/>
					),
					container,
				);
			},

			onUpdate(props: SuggestionProps) {
				if (!container) return;

				if (props.clientRect) {
					const rect = props.clientRect();
					if (rect) {
						container.style.left = `${rect.left + window.scrollX}px`;
						container.style.top = `${rect.bottom + window.scrollY + 4}px`;
					}
				}

				// Re-render with updated items, we re-mount to pass new props.
				if (dispose) dispose();
				dispose = render(
					() => (
						<MentionList
							ref={(el: HTMLDivElement) => {
								listRef = el;
							}}
							items={props.items as SuggestionItem[]}
							char={char}
							command={props.command}
						/>
					),
					container,
				);
			},

			onKeyDown(props: SuggestionKeyDownProps): boolean {
				if (!listRef) return false;
				const handlers = (listRef as any).__mentionHandlers;
				if (!handlers) return false;

				if (props.event.key === "ArrowUp") {
					handlers.upHandler();
					return true;
				}
				if (props.event.key === "ArrowDown") {
					handlers.downHandler();
					return true;
				}
				if (props.event.key === "Enter") {
					handlers.enterHandler();
					return true;
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
				listRef = null;
			},
		};
	};
};
