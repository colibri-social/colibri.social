import { Combobox } from "@kobalte/core/combobox";
import { MagnifierIcon } from "@solar-icons/solid/bold/magnifier";
import { createMemo, createSignal, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { menuContentClass } from "../ContextMenu/Menu";
import { matchesMember } from "../Roles/RoleMembers";
import {
	MemberIdentity,
	type MemberIdentityData,
	MemberNameLine,
	memberHandleLabel,
} from "./MemberIdentity";

const fieldShell = cx(
	"flex h-10 w-full items-center gap-2 rounded-control border border-border bg-secondary px-3",
	"transition-[border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
	"has-[:focus-visible]:border-primary",
	"has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
	"data-disabled:opacity-50",
);

const labelClass = "text-sm font-medium text-muted-foreground";

export const ownerCandidates = (
	members: readonly MemberIdentityData[],
	currentOwnerId?: string,
) => members.filter((member) => !member.bot && member.id !== currentOwnerId);

export type OwnerPickerProps = {
	members: readonly MemberIdentityData[];
	currentOwnerId?: string;
	value?: string;
	onChange: (id: string | undefined) => void;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	class?: string;
};

export const OwnerPicker = (props: OwnerPickerProps) => {
	const overflowPadding = usePopperOverflowPadding();
	const [query, setQuery] = createSignal("");
	let input: HTMLInputElement | undefined;
	const candidates = createMemo(() =>
		ownerCandidates(props.members, props.currentOwnerId),
	);
	const selected = () =>
		candidates().find((member) => member.id === props.value);
	const matches = () =>
		candidates().filter((member) => matchesMember(member, query()));
	const label = () => props.label ?? "New owner";

	const change = () => {
		setQuery("");
		props.onChange(undefined);
		requestAnimationFrame(() => input?.focus());
	};

	return (
		<div
			data-owner-picker=""
			class={cx("flex w-full flex-col gap-2", props.class)}
		>
			<Show
				when={selected()}
				fallback={
					<Combobox<MemberIdentityData>
						options={candidates()}
						optionValue="id"
						optionTextValue="name"
						optionLabel="name"
						value={null}
						onChange={(member) => {
							if (member) props.onChange(member.id);
						}}
						onInputChange={setQuery}
						defaultFilter={(member, text) => matchesMember(member, text)}
						triggerMode="input"
						allowsEmptyCollection
						disabled={props.disabled}
						placeholder={props.placeholder ?? "Search members..."}
						sameWidth
						gutter={6}
						placement="bottom-start"
						overflowPadding={overflowPadding()}
						class="flex w-full flex-col gap-2"
						itemComponent={(itemProps) => (
							<Combobox.Item
								item={itemProps.item}
								class={cx(
									"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control-sm px-2 py-1.5 text-left outline-none select-none",
									"data-highlighted:bg-popover-highlight",
								)}
							>
								<Avatar
									size="base"
									name={itemProps.item.rawValue.name}
									seed={itemProps.item.rawValue.id}
									src={itemProps.item.rawValue.avatarSrc}
									color={itemProps.item.rawValue.avatarColor}
								/>
								<span class="flex min-w-0 flex-1 flex-col">
									<Combobox.ItemLabel class="min-w-0">
										<MemberNameLine member={itemProps.item.rawValue} />
									</Combobox.ItemLabel>
									<Show when={itemProps.item.rawValue.handle}>
										{(handle) => (
											<Combobox.ItemDescription class="truncate text-xs leading-4 text-muted-foreground">
												{memberHandleLabel(handle())}
											</Combobox.ItemDescription>
										)}
									</Show>
								</span>
							</Combobox.Item>
						)}
					>
						<Combobox.Label class={labelClass}>{label()}</Combobox.Label>
						<Combobox.Control class={fieldShell}>
							<span
								aria-hidden="true"
								class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
							>
								<MagnifierIcon />
							</span>
							<Combobox.Input
								ref={(element: HTMLInputElement) => {
									input = element;
								}}
								class="min-w-0 flex-1 bg-transparent font-sans text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
							/>
						</Combobox.Control>
						<Combobox.Portal>
							<Combobox.Content
								{...topLayerAttrs}
								ref={revealLayer}
								class={cx(
									menuContentClass,
									"max-w-none min-w-0 origin-(--kb-combobox-content-transform-origin)",
								)}
							>
								<Combobox.Listbox class="flex max-h-[min(320px,var(--kb-popper-content-available-height))] flex-col overflow-y-auto outline-none" />
								<Show when={matches().length === 0}>
									<p
										data-owner-picker-empty=""
										class="m-0 px-2 py-3 text-center text-sm text-muted-foreground"
									>
										{candidates().length === 0
											? "There's no one else to transfer ownership to."
											: `No members match "${query().trim()}".`}
									</p>
								</Show>
							</Combobox.Content>
						</Combobox.Portal>
					</Combobox>
				}
			>
				{(member) => (
					<>
						<span class={labelClass}>{label()}</span>
						<div
							data-owner-picker-selected={member().id}
							class="flex w-full items-center gap-2 rounded-control border border-border bg-secondary p-[7px] pr-2"
						>
							<MemberIdentity
								member={member()}
								avatarSize="md"
								class="flex-1"
							/>
							<Button
								variant="tertiary"
								class="h-8 px-3"
								onClick={change}
								disabled={props.disabled}
								aria-label={`Change new owner, currently ${member().name}`}
							>
								Change
							</Button>
						</div>
					</>
				)}
			</Show>
		</div>
	);
};
