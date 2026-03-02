import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import type { ChannelData } from "@/utils/sdk";
import { ImageForChannelType } from "../IconForChannelType";

export type ChannelMentionState = {
	query: string;
	top: number;
	left: number;
	hashCharOffset: number;
	hashByteOffset: number;
};

export const ChannelMentionPopup: Component<{
	state: Accessor<ChannelMentionState | null>;
	channels: Accessor<Array<ChannelData>>;
	onSelect: (channel: ChannelData) => void;
	onDismiss: () => void;
}> = (props) => {
	const [selectedIndex, setSelectedIndex] = createSignal(0);

	const filtered = () => {
		const s = props.state();
		if (!s) return [];
		const q = s.query.toLowerCase();
		return props.channels().filter((ch) => ch.name.toLowerCase().startsWith(q));
	};

	createEffect(
		on(
			() => props.state()?.query,
			() => {
				setSelectedIndex(0);
			},
		),
	);

	const handleKeyDown = (e: KeyboardEvent) => {
		const s = props.state();
		if (!s) return;

		const items = filtered();
		if (items.length === 0 && e.key !== "Escape") return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			e.stopPropagation();
			const item = items[selectedIndex()];
			if (item) {
				props.onSelect(item);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			props.onDismiss();
		}
	};

	createEffect(() => {
		const s = props.state();
		if (s) {
			document.addEventListener("keydown", handleKeyDown, true);
		} else {
			document.removeEventListener("keydown", handleKeyDown, true);
		}
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown, true);
	});

	return (
		<Show when={props.state()}>
			{(state) => (
				<Show when={filtered().length > 0}>
					<div
						class="absolute z-50 min-w-48 max-w-72 max-h-60 overflow-y-auto bg-card border border-border rounded-md shadow-lg py-1"
						style={{
							bottom: `${window.innerHeight - state().top + 8}px`,
							left: `${state().left}px`,
							position: "fixed",
						}}
					>
						<For each={filtered()}>
							{(channel, index) => (
								<button
									type="button"
									class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 cursor-pointer hover:bg-muted/50"
									classList={{
										"bg-muted": index() === selectedIndex(),
									}}
									onMouseDown={(e) => {
										e.preventDefault();
										props.onSelect(channel);
									}}
									onMouseEnter={() => setSelectedIndex(index())}
								>
									<span class="text-muted-foreground">
										<ImageForChannelType channelType={channel.type} />
									</span>
									<span class="truncate">{channel.name}</span>
								</button>
							)}
						</For>
					</div>
				</Show>
			)}
		</Show>
	);
};
