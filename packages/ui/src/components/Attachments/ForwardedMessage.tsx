import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { LockKeyholeIcon } from "@solar-icons/solid/bold/lock-keyhole";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import { createPressRipple, pressSurface } from "./shared";

export type ForwardSource = {
	channel?: string;
	space?: string;
	spaceIconSrc?: string;
	href?: string;
};

export type ForwardedMessageProps = {
	author: string;
	time: string;
	source?: ForwardSource;
	children?: JSX.Element;
	class?: string;
};

const sourceLabel = (source: ForwardSource) =>
	source.space ? `#${source.channel} in ${source.space}` : `#${source.channel}`;

const chipClass =
	"inline-flex w-fit max-w-full items-center gap-1 rounded-control-xs bg-muted px-1.5 py-0.5 text-xs text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0";

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
				<Show
					when={source().href}
					fallback={
						<span class={chipClass}>
							<span class="truncate">From {sourceLabel(source())}</span>
						</span>
					}
				>
					{(href) => (
						<a
							ref={press}
							href={href()}
							class={cx(
								chipClass,
								"no-underline hover:bg-accent hover:text-foreground",
								pressSurface,
							)}
						>
							<Show when={source().space}>
								{(space) => (
									<Avatar
										name={space()}
										src={source().spaceIconSrc}
										size="xs"
										shape="square"
										class="size-3.5"
									/>
								)}
							</Show>
							<span class="truncate">From {sourceLabel(source())}</span>
							<AltArrowRightIcon />
						</a>
					)}
				</Show>
			)}
		</Show>
	);
};

export const ForwardedMessage = (props: ForwardedMessageProps) => (
	<div
		data-forwarded-message=""
		class={cx("flex w-full max-w-[480px] gap-3", props.class)}
	>
		<span aria-hidden="true" class="w-0.5 shrink-0 rounded-full bg-accent" />
		<div class="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
			<span class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground [&>svg]:size-3.5">
				<ForwardIcon />
				<span>
					Forwarded from{" "}
					<span class="font-semibold text-foreground">{props.author}</span>
				</span>
				<span aria-hidden="true">·</span>
				<span>{props.time}</span>
			</span>
			<div class="flex min-w-0 flex-col gap-2 text-base text-foreground">
				{props.children}
			</div>
			<SourceChip source={props.source} />
		</div>
	</div>
);
