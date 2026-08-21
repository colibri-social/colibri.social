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
import CaretRightIcon from "~icons/ph/caret-right";
import ClockIcon from "~icons/ph/clock";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../../atproto/xrpc/social/colibri/community/listRoles";
import { parseEmojiText } from "../../../../utils/emoji";
import { ChannelTypeIcon } from "../../community/ChannelTypeIcon";
import User from "../../user";
import { displayableNameFn } from "../../user/DisplayableName";
import { CHIP_GLYPH_CLASS } from "../channel-chip";
import type {
	ChannelSuggestion,
	EmojiSuggestionData,
	SuggestionItem,
	selectItem,
	TimeShortcut,
} from "./MentionPopupRenderer";

export function isMember(item: SuggestionItem): item is Member {
	return "did" in item;
}

export function isRole(item: SuggestionItem): item is Role {
	return "permissions" in item;
}

export function isChannel(item: SuggestionItem): item is ChannelSuggestion {
	return "uri" in item;
}

export function isEmoji(item: SuggestionItem): item is EmojiSuggestionData {
	return "emoji" in item;
}

export function isTimeShortcut(item: SuggestionItem): item is TimeShortcut {
	return "timeShortcut" in item;
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

	const groupRank = (item: SuggestionItem): number => {
		if (isTimeShortcut(item)) return 3;
		if (isMember(item)) return 0;
		if (isRole(item)) return 1;
		return 2;
	};

	const sorted: Accessor<SuggestionItem[]> = () =>
		[...props.items].sort((a, b) => groupRank(a) - groupRank(b));

	const members = () => sorted().filter(isMember);
	const roles = () => sorted().filter(isRole);
	const others = () =>
		sorted().filter(
			(item) => !isMember(item) && !isRole(item) && !isTimeShortcut(item),
		);
	const regular = () => sorted().filter((item) => !isTimeShortcut(item));
	const hasTimeShortcut = () => sorted().some(isTimeShortcut);

	const ItemButton: Component<{
		item: SuggestionItem;
		index: Accessor<number>;
	}> = (bprops) => (
		<button
			class={`flex flex-row gap-4 items-center justify-between px-2 py-1 rounded-sm`}
			classList={{
				"bg-muted": bprops.index() === props.selectedIndex(),
			}}
			onClick={() => props.selectItem(sorted(), props.command, bprops.index())}
			onMouseEnter={() => props.setSelectedIndex(bprops.index())}
			type="button"
		>
			<Switch>
				<Match when={isMember(bprops.item)}>
					<div class="flex flex-row items-center justify-between gap-1.5">
						<span class="relative">
							<User.Avatar user={bprops.item as Member} size="small" />
							<span
								class="absolute bottom-1 right-1 rounded-full"
								classList={{
									"bg-green-500":
										(bprops.item as Member).data.onlineState === "online",
									"bg-yellow-500":
										(bprops.item as Member).data.onlineState === "away",
									"bg-red-500":
										(bprops.item as Member).data.onlineState === "dnd",
									"bg-neutral-500":
										(bprops.item as Member).data.onlineState === "offline",
								}}
							/>
						</span>
						<span class="flex flex-col items-start">
							<span class="text-sm">
								{displayableNameFn(bprops.item as Member)}
							</span>
						</span>
					</div>
					<span class="text-sm text-muted-foreground">
						{(bprops.item as Member).handle.replaceAll("at://", "") ||
							(bprops.item as Member).did}
					</span>
				</Match>
				<Match when={isRole(bprops.item)}>
					<div class="flex flex-row items-center gap-1.5">
						<span
							class="size-3 rounded-full"
							style={{
								"background-color":
									(bprops.item as Role).color || "currentColor",
							}}
						/>
						<span class="text-sm">{(bprops.item as Role).name}</span>
					</div>
				</Match>
				<Match when={isChannel(bprops.item)}>
					<div class="flex flex-row items-center justify-between gap-1.5">
						<span>
							<ChannelTypeIcon type={(bprops.item as ChannelSuggestion).type} />
						</span>
						<Show when={(bprops.item as ChannelSuggestion).categoryLabel}>
							{(category) => (
								<>
									<span class="text-sm text-muted-foreground">
										{category()}
									</span>
									<CaretRightIcon class={CHIP_GLYPH_CLASS} />
								</>
							)}
						</Show>
						<span class="text-sm">
							{(bprops.item as ChannelSuggestion).name}
						</span>
					</div>
				</Match>
				<Match when={isEmoji}>
					<div class="flex flex-row items-center justify-between gap-1.5">
						<span
							innerHTML={parseEmojiText(
								(bprops.item as EmojiSuggestionData).emoji,
							)}
							class="[&>img]:w-5 [&>img]:h-5"
						/>
						<span class="text-sm">
							{(bprops.item as EmojiSuggestionData).name}
						</span>
					</div>
				</Match>
			</Switch>
		</button>
	);

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
				<Show when={members().length > 0}>
					<span class="text-xs text-muted-foreground mb-2">MEMBERS</span>
					<For each={members()}>
						{(item, index) => <ItemButton item={item} index={index} />}
					</For>
				</Show>
				<Show when={roles().length > 0}>
					<span
						class="text-xs text-muted-foreground mb-2"
						classList={{ "mt-3": members().length > 0 }}
					>
						ROLES
					</span>
					<For each={roles()}>
						{(item, index) => (
							<ItemButton
								item={item}
								index={() => members().length + index()}
							/>
						)}
					</For>
				</Show>
				<Show when={others().length > 0}>
					<span class="text-xs text-muted-foreground mb-2">
						{emptyPopupStr().toUpperCase()}
					</span>
					<For each={others()}>
						{(item, index) => (
							<ItemButton
								item={item}
								index={() => members().length + roles().length + index()}
							/>
						)}
					</For>
				</Show>
				<Show when={hasTimeShortcut()}>
					<span
						class="text-xs text-muted-foreground mb-2"
						classList={{ "mt-3": regular().length > 0 }}
					>
						TIME
					</span>
					<button
						class={`flex flex-row gap-4 items-center justify-between px-2 py-1 rounded-sm`}
						classList={{
							"bg-muted": regular().length === props.selectedIndex(),
						}}
						onClick={() =>
							props.selectItem(sorted(), props.command, regular().length)
						}
						onMouseEnter={() => props.setSelectedIndex(regular().length)}
						type="button"
					>
						<div class="flex flex-row items-center gap-1.5">
							<ClockIcon class="text-muted-foreground" />
							<span class="text-sm">Time</span>
						</div>
						<span class="text-sm text-muted-foreground">
							Insert a timestamp
						</span>
					</button>
				</Show>
			</Show>
		</div>
	);
};
