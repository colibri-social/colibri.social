import { type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { Avatar } from "../Avatar/Avatar";
import {
	type MemberIdentityData,
	MemberNameLine,
	memberHandleLabel,
} from "./MemberIdentity";

export type MemberActionRowProps = {
	member: MemberIdentityData;
	detail?: JSX.Element;
	stackDetail?: boolean;
	note?: JSX.Element;
	actions?: JSX.Element;
	onOpen?: (event: MouseEvent) => void;
	"aria-label"?: string;
	class?: string;
};

export const MemberActionRow = (props: MemberActionRowProps) => {
	const detail = createSlot(() => props.detail);
	const note = createSlot(() => props.note);
	const actions = createSlot(() => props.actions);
	const ripple = createRipple();
	const interactive = () => !!props.onOpen;

	return (
		<Dynamic
			component={interactive() ? "button" : "div"}
			type={interactive() ? "button" : undefined}
			ref={(element: HTMLElement) => {
				if (interactive()) ripple(element);
			}}
			data-member-action-row={props.member.id}
			aria-label={props["aria-label"]}
			onClick={props.onOpen}
			class={cx(
				"flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left text-foreground",
				interactive() &&
					"ripple cursor-pointer outline-none hover:bg-secondary-highlight focus-ring-inset",
				props.class,
			)}
		>
			<Avatar
				size="md"
				name={props.member.name}
				seed={props.member.id}
				src={props.member.avatarSrc}
				color={props.member.avatarColor}
			/>
			<span class="flex min-w-0 flex-1 flex-col">
				<MemberNameLine member={props.member} />
				<Show
					when={props.stackDetail}
					fallback={
						<span class="flex min-w-0 items-center text-xs leading-4 text-muted-foreground">
							<Show when={props.member.handle}>
								{(handle) => (
									<span class="min-w-0 truncate select-text">
										{memberHandleLabel(handle())}
									</span>
								)}
							</Show>
							<Show when={props.member.handle && detail.has()}>
								<span aria-hidden="true" class="shrink-0 px-1">
									·
								</span>
							</Show>
							<Show when={detail.has()}>
								<span class="min-w-0 truncate">{detail()}</span>
							</Show>
						</span>
					}
				>
					<Show when={props.member.handle}>
						{(handle) => (
							<span
								data-member-action-handle=""
								class="min-w-0 text-xs leading-4 break-all text-muted-foreground select-text"
							>
								{memberHandleLabel(handle())}
							</span>
						)}
					</Show>
					<Show when={detail.has()}>
						<span
							data-member-action-detail=""
							class="min-w-0 text-xs leading-4 text-muted-foreground"
						>
							{detail()}
						</span>
					</Show>
				</Show>
				<Show when={note.has()}>
					<span class="mt-0.5 line-clamp-2 text-sm text-pretty text-foreground">
						{note()}
					</span>
				</Show>
			</span>
			<Show when={actions.has()}>
				<span class="flex shrink-0 items-center gap-1">{actions()}</span>
			</Show>
		</Dynamic>
	);
};
