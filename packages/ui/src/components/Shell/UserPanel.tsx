import { type JSX, Show } from "solid-js";
import { AnimatedSettingsIcon } from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { Avatar, type Presence } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import { AvatarSkeleton, SkeletonText } from "../Skeleton/Skeleton";

export type UserPanelProps = {
	name: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence?: Presence;
	status?: JSX.Element;
	voice?: JSX.Element;
	onOpenProfile?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	onOpenSettings?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	settingsLabel?: string;
	class?: string;
};

export const userPanelSurface =
	"flex w-full flex-col overflow-hidden rounded-surface border border-border bg-popover shadow-[0_4px_12px_rgb(0_0_0/0.45)] light:shadow-[0_4px_12px_rgb(0_0_0/0.12)]";

export const UserPanel = (props: UserPanelProps) => {
	const status = createSlot(() => props.status);
	const voice = createSlot(() => props.voice);
	const ripple = createRipple();

	return (
		<section
			aria-label="Your account"
			data-user-panel=""
			class={cx(userPanelSurface, props.class)}
			style={{ "--avatar-ring": "var(--popover)" }}
		>
			<Show when={voice.has()}>
				<div data-user-panel-voice="" class="border-b border-border">
					{voice()}
				</div>
			</Show>
			<div class="flex h-[54px] items-center gap-2 p-[7px]">
				<button
					ref={ripple}
					type="button"
					onClick={(event) => props.onOpenProfile?.(event)}
					data-user-panel-profile=""
					class="ripple flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control px-1 text-left text-foreground outline-none hover:bg-popover-highlight focus-ring"
				>
					<Avatar
						name={props.name}
						src={props.avatarSrc}
						color={props.avatarColor}
						presence={props.presence}
						size="base"
					/>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-base leading-5 font-semibold">
							{props.name}
						</span>
						<Show when={status.has()}>
							<span class="truncate text-xs leading-4 text-muted-foreground">
								{status()}
							</span>
						</Show>
					</span>
				</button>
				<IconButton
					variant="ghost"
					size="md"
					label={props.settingsLabel ?? "Settings"}
					icon={<AnimatedSettingsIcon />}
					onClick={(event) => props.onOpenSettings?.(event)}
				/>
			</div>
		</section>
	);
};

export const UserPanelSkeleton = (props: { class?: string }) => (
	<div aria-hidden="true" class={cx(userPanelSurface, props.class)}>
		<div class="flex h-[54px] items-center gap-2 p-[7px]">
			<span class="flex h-10 min-w-0 flex-1 items-center gap-2 px-1">
				<AvatarSkeleton size="base" />
				<span class="flex min-w-0 flex-1 flex-col">
					<SkeletonText size="base" leading={20} width="50%" />
					<SkeletonText size="xs" leading={16} width="75%" />
				</span>
			</span>
			<span class="size-8 shrink-0" />
		</div>
	</div>
);
