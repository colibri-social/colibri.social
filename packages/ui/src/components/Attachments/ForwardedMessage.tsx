import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { LockKeyholeIcon } from "@solar-icons/solid/bold/lock-keyhole";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import { createPressRipple, pressSurface } from "./shared";

export type ForwardSource = {
	channel?: string;
	space?: string;
	spaceIconSrc?: string;
	href?: string;
	onOpen?: () => void;
};

export type ForwardedMessageProps = {
	time: string;
	source?: ForwardSource;
	children?: JSX.Element;
	class?: string;
};

const sourceLabel = (source: ForwardSource) =>
	source.space ? `#${source.channel} in ${source.space}` : `#${source.channel}`;

const chipClass =
	"inline-flex w-fit max-w-full items-center gap-1 rounded-control-xs bg-muted px-1.5 py-0.5 text-xs text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0";

const interactiveChipClass = cx(
	chipClass,
	"cursor-pointer border-0 no-underline hover:bg-accent hover:text-foreground",
	pressSurface,
);

const SourceChipBody = (props: { source: ForwardSource }) => (
	<>
		<Show when={props.source.space}>
			{(space) => (
				<Avatar
					name={space()}
					src={props.source.spaceIconSrc}
					size="xs"
					shape="square"
					class="size-3.5"
				/>
			)}
		</Show>
		<span class="truncate">From {sourceLabel(props.source)}</span>
		<AltArrowRightIcon />
	</>
);

const SourceChip = (props: { source?: ForwardSource }) => {
	const press = createPressRipple();
	return (
		<Show
			when={props.source?.channel ? props.source : undefined}
			fallback={
				<span class={chipClass}>
					<LockKeyholeIcon />
					From a private channel
				</span>
			}
		>
			{(source) => (
				<Switch
					fallback={
						<span class={chipClass}>
							<span class="truncate">From {sourceLabel(source())}</span>
						</span>
					}
				>
					<Match when={source().onOpen}>
						{(onOpen) => (
							<button
								ref={press}
								type="button"
								data-forward-source=""
								onClick={(event) => {
									event.stopPropagation();
									onOpen()();
								}}
								class={interactiveChipClass}
							>
								<SourceChipBody source={source()} />
							</button>
						)}
					</Match>
					<Match when={source().href}>
						{(href) => (
							<a
								ref={press}
								href={href()}
								data-forward-source=""
								class={interactiveChipClass}
							>
								<SourceChipBody source={source()} />
							</a>
						)}
					</Match>
				</Switch>
			)}
		</Show>
	);
};

export const ForwardedMessage = (props: ForwardedMessageProps) => {
	return (
		<div
			data-forwarded-message=""
			class={cx("flex w-full max-w-[480px] gap-3", props.class)}
		>
			<span aria-hidden="true" class="w-0.5 shrink-0 rounded-full bg-accent" />
			<div class="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
				<span class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground [&>svg]:size-3.5">
					<ForwardIcon />
					<span>Forwarded</span>
					<span aria-hidden="true">·</span>
					<span>{props.time}</span>
				</span>
				<div class="flex min-w-0 flex-col gap-2 text-base text-foreground select-text">
					{props.children}
				</div>
				<SourceChip source={props.source} />
			</div>
		</div>
	);
};
