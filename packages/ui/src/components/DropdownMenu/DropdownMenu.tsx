import { DropdownMenu as KobalteDropdownMenu } from "@kobalte/core/dropdown-menu";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import {
	createEffect,
	createSignal,
	For,
	type JSX,
	Match,
	on,
	Show,
	Switch,
	type ValidComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { motionScale } from "../../utils/motion";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import {
	MenuItem,
	type MenuItemTone,
	MenuSeparator,
	menuContentClass,
	menuItemClass,
	menuItemToneClass,
} from "../ContextMenu/Menu";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import {
	DestructiveRow,
	ListGroup,
	RadioRow,
	RadioRowGroup,
	ToggleRow,
} from "../List/List";
import { ActionRow } from "../MessageActions/MessageActionsDrawer";

export type DropdownMenuPlatform = "mobile" | "desktop";

export type DropdownMenuPlacement =
	| "top"
	| "top-start"
	| "top-end"
	| "bottom"
	| "bottom-start"
	| "bottom-end"
	| "left"
	| "right";

export type DropdownMenuItemEntry = {
	kind?: "item";
	label: string;
	icon?: JSX.Element;
	tone?: MenuItemTone;
	disabled?: boolean;
	hint?: string;
	onSelect?: () => void;
};

export type DropdownMenuCheckboxEntry = {
	kind: "checkbox";
	label: string;
	icon?: JSX.Element;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
};

export type DropdownMenuRadioOption = {
	value: string;
	label: string;
	description?: string;
	icon?: JSX.Element;
	disabled?: boolean;
};

export type DropdownMenuRadioEntry = {
	kind: "radio";
	label?: string;
	value?: string;
	onChange: (value: string) => void;
	options: DropdownMenuRadioOption[];
};

export type DropdownMenuSubmenuEntry = {
	kind: "submenu";
	label: string;
	icon?: JSX.Element;
	disabled?: boolean;
	items: DropdownMenuEntry[];
};

export type DropdownMenuSeparatorEntry = { kind: "separator" };
export type DropdownMenuLabelEntry = { kind: "label"; label: string };

export type DropdownMenuEntry =
	| DropdownMenuItemEntry
	| DropdownMenuCheckboxEntry
	| DropdownMenuRadioEntry
	| DropdownMenuSubmenuEntry
	| DropdownMenuSeparatorEntry
	| DropdownMenuLabelEntry;

type GroupedEntry =
	| DropdownMenuItemEntry
	| DropdownMenuCheckboxEntry
	| DropdownMenuSubmenuEntry;

type MenuGroup =
	| { kind: "group"; label?: string; entries: GroupedEntry[] }
	| { kind: "radio"; entry: DropdownMenuRadioEntry };

export const groupMenuEntries = (entries: DropdownMenuEntry[]): MenuGroup[] => {
	const groups: MenuGroup[] = [];
	let current:
		| { kind: "group"; label?: string; entries: GroupedEntry[] }
		| undefined;
	const flush = () => {
		if (current && current.entries.length > 0) groups.push(current);
		current = undefined;
	};
	for (const entry of entries) {
		switch (entry.kind) {
			case "separator":
				flush();
				break;
			case "label":
				flush();
				current = { kind: "group", label: entry.label, entries: [] };
				break;
			case "radio":
				flush();
				groups.push({ kind: "radio", entry });
				break;
			default:
				if (!current) current = { kind: "group", entries: [] };
				current.entries.push(entry);
		}
	}
	flush();
	return groups;
};

const flattenSubmenus = (entries: DropdownMenuEntry[]): DropdownMenuEntry[] =>
	entries.flatMap((entry) =>
		entry.kind === "submenu"
			? [
					{ kind: "separator" } as const,
					{ kind: "label", label: entry.label } as const,
					...flattenSubmenus(
						entry.disabled
							? entry.items.map((item) =>
									item.kind === undefined || item.kind === "item"
										? { ...item, disabled: true }
										: item,
								)
							: entry.items,
					),
					{ kind: "separator" } as const,
				]
			: [entry],
	);

const indicatorClass =
	"ml-auto flex size-4 shrink-0 items-center justify-center text-primary-highlight [&>svg]:size-4";

const groupLabelClass =
	"flex h-7 items-center px-2 text-xs font-semibold text-muted-foreground";

const DesktopEntry = (props: { entry: GroupedEntry }) => (
	<Switch>
		<Match when={props.entry.kind === "checkbox" && props.entry}>
			{(entry) => (
				<KobalteDropdownMenu.CheckboxItem
					checked={(entry() as DropdownMenuCheckboxEntry).checked}
					onChange={(entry() as DropdownMenuCheckboxEntry).onChange}
					disabled={entry().disabled}
					closeOnSelect={false}
					class={cx(menuItemClass, menuItemToneClass.default)}
				>
					<Show when={(entry() as DropdownMenuCheckboxEntry).icon}>
						{(icon) => (
							<span
								aria-hidden="true"
								class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
							>
								{icon()}
							</span>
						)}
					</Show>
					<span class="min-w-0 flex-1 truncate">{entry().label}</span>
					<KobalteDropdownMenu.ItemIndicator class={indicatorClass}>
						<CheckIcon />
					</KobalteDropdownMenu.ItemIndicator>
				</KobalteDropdownMenu.CheckboxItem>
			)}
		</Match>
		<Match when={props.entry.kind === "submenu" && props.entry}>
			{(entry) => (
				<DesktopSubmenu entry={entry() as DropdownMenuSubmenuEntry} />
			)}
		</Match>
		<Match
			when={props.entry.kind !== "checkbox" && props.entry.kind !== "submenu"}
		>
			<MenuItem
				label={props.entry.label}
				icon={(props.entry as DropdownMenuItemEntry).icon}
				tone={(props.entry as DropdownMenuItemEntry).tone}
				disabled={props.entry.disabled}
				hint={(props.entry as DropdownMenuItemEntry).hint}
				onSelect={(props.entry as DropdownMenuItemEntry).onSelect}
			/>
		</Match>
	</Switch>
);

export const MenuEntryGroups = (props: { entries: DropdownMenuEntry[] }) => {
	const groups = () => groupMenuEntries(props.entries);
	return (
		<For each={groups()}>
			{(group, index) => (
				<>
					<Show when={index() > 0}>
						<MenuSeparator />
					</Show>
					<Switch>
						<Match when={group.kind === "radio" && group}>
							{(radio) => {
								const entry = () =>
									(radio() as { kind: "radio"; entry: DropdownMenuRadioEntry })
										.entry;
								return (
									<KobalteDropdownMenu.RadioGroup
										value={entry().value}
										onChange={entry().onChange}
										class="flex flex-col"
									>
										<Show when={entry().label}>
											<KobalteDropdownMenu.GroupLabel
												as="div"
												class={groupLabelClass}
											>
												{entry().label}
											</KobalteDropdownMenu.GroupLabel>
										</Show>
										<For each={entry().options}>
											{(option) => (
												<KobalteDropdownMenu.RadioItem
													value={option.value}
													disabled={option.disabled}
													closeOnSelect
													class={cx(
														menuItemClass,
														menuItemToneClass.default,
														option.description && "h-auto min-h-8 py-1.5",
													)}
												>
													<Show when={option.icon}>
														<span
															aria-hidden="true"
															class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
														>
															{option.icon}
														</span>
													</Show>
													<span class="flex min-w-0 flex-1 flex-col">
														<span class="truncate">{option.label}</span>
														<Show when={option.description}>
															<span class="text-xs font-medium text-pretty text-muted-foreground">
																{option.description}
															</span>
														</Show>
													</span>
													<KobalteDropdownMenu.ItemIndicator
														class={indicatorClass}
													>
														<CheckIcon />
													</KobalteDropdownMenu.ItemIndicator>
												</KobalteDropdownMenu.RadioItem>
											)}
										</For>
									</KobalteDropdownMenu.RadioGroup>
								);
							}}
						</Match>
						<Match when={group.kind === "group" && group}>
							{(plain) => {
								const value = () =>
									plain() as {
										kind: "group";
										label?: string;
										entries: GroupedEntry[];
									};
								return (
									<KobalteDropdownMenu.Group class="flex flex-col">
										<Show when={value().label}>
											<KobalteDropdownMenu.GroupLabel
												as="div"
												class={groupLabelClass}
											>
												{value().label}
											</KobalteDropdownMenu.GroupLabel>
										</Show>
										<For each={value().entries}>
											{(entry) => <DesktopEntry entry={entry} />}
										</For>
									</KobalteDropdownMenu.Group>
								);
							}}
						</Match>
					</Switch>
				</>
			)}
		</For>
	);
};

const DesktopSubmenu = (props: { entry: DropdownMenuSubmenuEntry }) => {
	const overflowPadding = usePopperOverflowPadding();
	return (
		<KobalteDropdownMenu.Sub
			overflowPadding={overflowPadding()}
			gutter={4}
			shift={-5}
		>
			<KobalteDropdownMenu.SubTrigger
				disabled={props.entry.disabled}
				class={cx(
					menuItemClass,
					menuItemToneClass.default,
					"data-expanded:bg-popover-highlight",
				)}
			>
				<Show when={props.entry.icon}>
					<span
						aria-hidden="true"
						class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
					>
						{props.entry.icon}
					</span>
				</Show>
				<span class="min-w-0 flex-1 truncate">{props.entry.label}</span>
				<AltArrowRightIcon
					aria-hidden="true"
					class="size-4 shrink-0 text-muted-foreground"
				/>
			</KobalteDropdownMenu.SubTrigger>
			<KobalteDropdownMenu.Portal>
				<KobalteDropdownMenu.SubContent
					{...topLayerAttrs}
					ref={revealLayer}
					class={cx(
						menuContentClass,
						"max-h-(--kb-popper-content-available-height) overflow-y-auto",
					)}
				>
					<MenuEntryGroups entries={props.entry.items} />
				</KobalteDropdownMenu.SubContent>
			</KobalteDropdownMenu.Portal>
		</KobalteDropdownMenu.Sub>
	);
};

const MobileGroups = (props: {
	entries: DropdownMenuEntry[];
	close: () => void;
}) => {
	const groups = () => groupMenuEntries(flattenSubmenus(props.entries));
	const run = (handler?: () => void) => () => {
		props.close();
		handler?.();
	};
	return (
		<For each={groups()}>
			{(group) => (
				<Switch>
					<Match when={group.kind === "radio" && group}>
						{(radio) => {
							const entry = () =>
								(radio() as { kind: "radio"; entry: DropdownMenuRadioEntry })
									.entry;
							return (
								<RadioRowGroup
									label={entry().label}
									aria-label={entry().label}
									value={entry().value}
									onChange={(value) => {
										entry().onChange(value);
										setTimeout(props.close, 120 * motionScale());
									}}
								>
									<For each={entry().options}>
										{(option) => (
											<RadioRow
												value={option.value}
												title={option.label}
												description={option.description}
												icon={option.icon}
												disabled={option.disabled}
											/>
										)}
									</For>
								</RadioRowGroup>
							);
						}}
					</Match>
					<Match when={group.kind === "group" && group}>
						{(plain) => {
							const value = () =>
								plain() as {
									kind: "group";
									label?: string;
									entries: GroupedEntry[];
								};
							return (
								<ListGroup label={value().label}>
									<For each={value().entries}>
										{(entry) => (
											<Switch>
												<Match when={entry.kind === "checkbox" && entry}>
													{(checkbox) => {
														const value = () =>
															checkbox() as DropdownMenuCheckboxEntry;
														return (
															<ToggleRow
																title={value().label}
																icon={value().icon}
																checked={value().checked}
																onChange={value().onChange}
																disabled={value().disabled}
															/>
														);
													}}
												</Match>
												<Match
													when={
														(entry as DropdownMenuItemEntry).tone ===
														"destructive"
													}
												>
													<DestructiveRow
														label={entry.label}
														icon={(entry as DropdownMenuItemEntry).icon}
														disabled={entry.disabled}
														onClick={run(
															(entry as DropdownMenuItemEntry).onSelect,
														)}
													/>
												</Match>
												<Match when={entry.kind !== "checkbox"}>
													<ActionRow
														label={entry.label}
														icon={(entry as DropdownMenuItemEntry).icon}
														disabled={entry.disabled}
														onClick={run(
															(entry as DropdownMenuItemEntry).onSelect,
														)}
													/>
												</Match>
											</Switch>
										)}
									</For>
								</ListGroup>
							);
						}}
					</Match>
				</Switch>
			)}
		</For>
	);
};

export type DropdownMenuProps = {
	platform?: DropdownMenuPlatform;
	items?: DropdownMenuEntry[];
	menu?: JSX.Element;
	label: string;
	title?: JSX.Element;
	trigger?: JSX.Element;
	triggerAs?: ValidComponent;
	triggerProps?: Record<string, unknown>;
	triggerClass?: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	placement?: DropdownMenuPlacement;
	contentClass?: string;
};

export const DropdownMenu = (props: DropdownMenuProps) => {
	const [internalOpen, setInternalOpen] = createSignal(
		props.defaultOpen ?? false,
	);
	const open = () => props.open ?? internalOpen();
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		props.onOpenChange?.(next);
	};
	const overflowPadding = usePopperOverflowPadding();
	const mobile = () => props.platform === "mobile";

	createEffect(
		on(
			mobile,
			() => {
				if (open()) setOpen(false);
			},
			{ defer: true },
		),
	);

	return (
		<Show
			when={mobile()}
			fallback={
				<KobalteDropdownMenu
					modal={false}
					open={open()}
					onOpenChange={setOpen}
					placement={props.placement ?? "bottom-end"}
					gutter={6}
					overflowPadding={overflowPadding()}
				>
					<KobalteDropdownMenu.Trigger
						as={props.triggerAs ?? "button"}
						type={props.triggerAs ? undefined : "button"}
						aria-label={props.triggerAs ? undefined : props.label}
						class={props.triggerClass}
						{...props.triggerProps}
					>
						{props.trigger}
					</KobalteDropdownMenu.Trigger>
					<KobalteDropdownMenu.Portal>
						<KobalteDropdownMenu.Content
							{...topLayerAttrs}
							ref={revealLayer}
							aria-label={props.label}
							class={cx(
								menuContentClass,
								"max-h-(--kb-popper-content-available-height) origin-(--kb-menu-content-transform-origin) overflow-y-auto",
								"data-closed:animate-[ui-fade-out_calc(var(--duration-exit)*var(--motion-scale))_var(--ease-exit)_both]",
								props.contentClass,
							)}
						>
							<Show
								when={props.menu}
								fallback={<MenuEntryGroups entries={props.items ?? []} />}
							>
								{props.menu}
							</Show>
						</KobalteDropdownMenu.Content>
					</KobalteDropdownMenu.Portal>
				</KobalteDropdownMenu>
			}
		>
			<Dynamic
				component={props.triggerAs ?? "button"}
				type={props.triggerAs ? undefined : "button"}
				aria-label={props.triggerAs ? undefined : props.label}
				aria-haspopup="dialog"
				aria-expanded={open()}
				class={props.triggerClass}
				{...props.triggerProps}
				onClick={() => setOpen(true)}
			>
				{props.trigger}
			</Dynamic>
			<Drawer open={open()} onOpenChange={setOpen}>
				<DrawerContent title={props.title} aria-label={props.label}>
					<MobileGroups
						entries={props.items ?? []}
						close={() => setOpen(false)}
					/>
				</DrawerContent>
			</Drawer>
		</Show>
	);
};
