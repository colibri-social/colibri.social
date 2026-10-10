import { AltArrowRightIcon } from "@solar-icons/solid/bold/alt-arrow-right";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { ClockCircleIcon } from "@solar-icons/solid/bold/clock-circle";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import {
	type Accessor,
	createEffect,
	For,
	type JSX,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import type { SuggestionItem, SuggestionTrigger } from "./suggestions";

export const suggestionOptionId = (listId: string, index: number) =>
	`${listId}-option-${index}`;

const SECTION_LABEL: Record<SuggestionItem["kind"], string> = {
	member: "Members",
	bridged: "Bridged",
	role: "Roles",
	channel: "Channels",
	emoji: "Emoji",
	time: "Time",
};

const EMPTY_LABEL: Record<SuggestionTrigger, string> = {
	"@": "No matching members",
	"#": "No matching channels",
	":": "No matching emoji",
};

const optionClass = cx(
	"flex min-h-10 cursor-pointer items-center gap-3 rounded-control-sm px-2 py-1.5",
	"data-active:bg-popover-highlight",
);

const SuggestionRow = (props: { item: SuggestionItem }): JSX.Element => (
	<Switch>
		<Match when={props.item.kind === "member" && props.item.member}>
			{(member) => (
				<>
					<Avatar
						size="sm"
						name={member().name}
						src={member().avatarSrc}
						color={member().color}
						presence={member().presence}
					/>
					<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
						{member().name}
					</span>
					<Show when={member().handle}>
						<span class="max-w-[45%] shrink-0 truncate text-sm text-muted-foreground">
							{member().handle}
						</span>
					</Show>
				</>
			)}
		</Match>
		<Match when={props.item.kind === "bridged" && props.item.person}>
			{(person) => (
				<>
					<Avatar size="sm" name={person().name} src={person().avatarSrc} />
					<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
						{person().name}
					</span>
					<span class="shrink-0 text-sm text-muted-foreground">
						on {person().platformName ?? person().platform}
					</span>
				</>
			)}
		</Match>
		<Match when={props.item.kind === "role" && props.item.role}>
			{(role) => (
				<>
					<span class="flex size-6 shrink-0 items-center justify-center">
						<span
							aria-hidden="true"
							class="size-3 rounded-full"
							style={{ "background-color": role().color ?? "currentColor" }}
						/>
					</span>
					<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
						@{role().name}
					</span>
				</>
			)}
		</Match>
		<Match when={props.item.kind === "channel" && props.item.channel}>
			{(channel) => (
				<>
					<span
						aria-hidden="true"
						class="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
					>
						<Show
							when={channel().kind === "voice"}
							fallback={<ChatSquareDotsIcon />}
						>
							<VolumeLoudIcon />
						</Show>
					</span>
					<span class="flex min-w-0 flex-1 items-center gap-1 text-sm">
						<Show when={channel().categoryLabel}>
							{(category) => (
								<>
									<span class="truncate text-muted-foreground">
										{category()}
									</span>
									<AltArrowRightIcon
										aria-hidden="true"
										class="size-3.5 shrink-0 text-muted-foreground"
									/>
								</>
							)}
						</Show>
						<span class="truncate font-medium text-foreground">
							{channel().name}
						</span>
					</span>
				</>
			)}
		</Match>
		<Match
			when={
				props.item.kind === "emoji" &&
				(props.item as Extract<SuggestionItem, { kind: "emoji" }>)
			}
		>
			{(emoji) => (
				<>
					<span
						aria-hidden="true"
						class="flex size-6 shrink-0 items-center justify-center text-xl leading-none"
					>
						{emoji().emoji}
					</span>
					<span class="min-w-0 flex-1 truncate text-sm text-foreground">
						:{emoji().name}:
					</span>
				</>
			)}
		</Match>
		<Match when={props.item.kind === "time"}>
			<span
				aria-hidden="true"
				class="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
			>
				<ClockCircleIcon />
			</span>
			<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
				Time
			</span>
			<span class="shrink-0 text-sm text-muted-foreground">
				Insert a timestamp
			</span>
		</Match>
	</Switch>
);

export type SuggestionListProps = {
	id: string;
	trigger: SuggestionTrigger;
	items: SuggestionItem[];
	activeIndex: Accessor<number>;
	onActiveIndexChange: (index: number) => void;
	onSelect: (index: number) => void;
};

export const SuggestionList = (props: SuggestionListProps) => {
	let list: HTMLDivElement | undefined;

	createEffect(
		on(props.activeIndex, (index) => {
			list
				?.querySelector(`#${CSS.escape(suggestionOptionId(props.id, index))}`)
				?.scrollIntoView({ block: "nearest" });
		}),
	);

	const startsSection = (index: number) =>
		index === 0 || props.items[index - 1].kind !== props.items[index].kind;

	return (
		<Show
			when={props.items.length > 0}
			fallback={
				<p class="px-3 py-2.5 text-sm text-muted-foreground" role="status">
					{EMPTY_LABEL[props.trigger]}
				</p>
			}
		>
			<div
				ref={list}
				id={props.id}
				role="listbox"
				aria-label="Suggestions"
				class="flex flex-col p-1"
			>
				<For each={props.items}>
					{(item, index) => (
						<>
							<Show when={startsSection(index())}>
								<p
									aria-hidden="true"
									class={cx(
										"eyebrow px-2 pb-1",
										index() === 0 ? "pt-1.5" : "pt-3",
									)}
								>
									{SECTION_LABEL[item.kind]}
								</p>
							</Show>
							<div
								id={suggestionOptionId(props.id, index())}
								role="option"
								tabIndex={-1}
								aria-selected={index() === props.activeIndex()}
								data-suggestion-kind={item.kind}
								data-active={index() === props.activeIndex() || undefined}
								class={optionClass}
								onPointerDown={(event) => event.preventDefault()}
								onPointerMove={(event) => {
									if (event.pointerType === "mouse") {
										props.onActiveIndexChange(index());
									}
								}}
								onClick={() => props.onSelect(index())}
							>
								<SuggestionRow item={item} />
							</div>
						</>
					)}
				</For>
			</div>
		</Show>
	);
};
