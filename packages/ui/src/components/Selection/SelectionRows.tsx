import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar } from "../Avatar/Avatar";
import { Checkbox } from "../Checkbox/Checkbox";
import {
	type MemberIdentityData,
	MemberNameLine,
	memberHandleLabel,
} from "../Members/MemberIdentity";
import { type RoleIdentity, RoleMark } from "../Roles/RoleBadge";

const toggleFromRow = (event: MouseEvent & { currentTarget: HTMLElement }) => {
	const target = event.target as Element | null;
	const input = event.currentTarget.querySelector<HTMLInputElement>(
		"[data-selectable-control] input",
	);
	if (!input || !target || input.disabled) return;
	if (target.closest("input, button, a, label")) return;
	if (target.closest("[data-selectable-control]")) {
		if (input.nextElementSibling?.contains(target)) return;
	}
	input.click();
};

export type SelectableRowDensity = "comfortable" | "compact";
export type SelectableRowSurface = "flush" | "card";

export type SelectableRowProps = {
	label: JSX.Element;
	"aria-label": string;
	description?: JSX.Element;
	leading?: JSX.Element;
	trailing?: JSX.Element;
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	name?: string;
	value?: string;
	density?: SelectableRowDensity;
	surface?: SelectableRowSurface;
	class?: string;
};

export const SelectableRow = (props: SelectableRowProps) => {
	const leading = createSlot(() => props.leading);
	const label = createSlot(() => props.label);
	const description = createSlot(() => props.description);
	const trailing = createSlot(() => props.trailing);
	const ripple = createRipple({ disabled: () => props.disabled });
	const density = () => props.density ?? "comfortable";
	const surface = () => props.surface ?? "flush";

	return (
		<div
			ref={ripple}
			data-selectable-row=""
			data-density={density()}
			onClick={toggleFromRow}
			class={cx(
				"ripple flex w-full shrink-0 cursor-pointer items-center text-foreground",
				density() === "comfortable" ? "min-h-14 gap-3 py-2" : "h-10 gap-2",
				surface() === "flush"
					? "-mx-2 w-[calc(100%+16px)] rounded-control-lg px-2 hover:bg-secondary"
					: "pr-2 pl-3 hover:bg-secondary-highlight",
				props.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
				props.class,
			)}
		>
			<Show when={leading.has()}>
				<span class="flex shrink-0 items-center justify-center">
					{leading()}
				</span>
			</Show>
			<span class="flex min-w-0 flex-1 flex-col">
				<span
					class={cx(
						"flex min-w-0 items-center font-semibold",
						density() === "comfortable" ? "text-base" : "text-sm",
					)}
				>
					{label()}
				</span>
				<Show when={description.has()}>
					<span class="truncate text-xs leading-4 text-muted-foreground">
						{description()}
					</span>
				</Show>
			</span>
			<Show when={trailing.has()}>
				<span class="flex min-w-0 shrink items-center gap-2">{trailing()}</span>
			</Show>
			<span data-selectable-control="" class="flex shrink-0">
				<Checkbox
					aria-label={props["aria-label"]}
					checked={props.checked}
					defaultChecked={props.defaultChecked}
					onChange={props.onChange}
					disabled={props.disabled}
					name={props.name}
					value={props.value}
				/>
			</span>
		</div>
	);
};

type SelectionState = Pick<
	SelectableRowProps,
	| "checked"
	| "defaultChecked"
	| "onChange"
	| "disabled"
	| "name"
	| "value"
	| "surface"
	| "class"
>;

export type RoleSelectRowProps = SelectionState & { role: RoleIdentity };

export const RoleSelectRow = (props: RoleSelectRowProps) => (
	<SelectableRow
		{...props}
		aria-label={props.role.name}
		leading={<RoleMark role={props.role} interactive={false} />}
		label={<span class="truncate">{props.role.name}</span>}
	/>
);

export type MemberSelectRowProps = SelectionState & {
	member: MemberIdentityData;
};

export const MemberSelectRow = (props: MemberSelectRowProps) => (
	<SelectableRow
		{...props}
		aria-label={props.member.name}
		leading={
			<Avatar
				size="md"
				name={props.member.name}
				seed={props.member.id}
				src={props.member.avatarSrc}
				color={props.member.avatarColor}
				presence={props.member.presence}
			/>
		}
		label={<MemberNameLine member={props.member} />}
		description={
			props.member.handle ? memberHandleLabel(props.member.handle) : undefined
		}
	/>
);

export type EmojiSelectRowProps = SelectionState & {
	name: string;
	src: string;
	uploader?: { handle: string; avatar?: string };
};

export const EmojiSelectRow = (props: EmojiSelectRowProps) => (
	<SelectableRow
		{...props}
		density="compact"
		surface={props.surface ?? "card"}
		aria-label={`:${props.name}:`}
		leading={
			<AnimatedImage
				src={props.src}
				alt=""
				width={24}
				height={24}
				class="size-6 shrink-0 object-contain"
			/>
		}
		label={<span class="truncate">:{props.name}:</span>}
		trailing={
			<Show when={props.uploader}>
				{(uploader) => (
					<>
						<span
							class="min-w-0 truncate text-xs text-muted-foreground"
							title={uploader().handle}
						>
							{uploader().handle}
						</span>
						<Show
							when={uploader().avatar}
							fallback={
								<span
									aria-hidden="true"
									class="size-4 shrink-0 rounded-full bg-accent"
								/>
							}
						>
							{(avatar) => (
								<AnimatedImage
									src={avatar()}
									alt=""
									width={16}
									height={16}
									class="size-4 shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8"
								/>
							)}
						</Show>
					</>
				)}
			</Show>
		}
	/>
);
