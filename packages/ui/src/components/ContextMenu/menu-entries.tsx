import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CheckReadIcon } from "@solar-icons/solid/bold/check-read";
import { CodeIcon } from "@solar-icons/solid/bold/code";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { createMemo, type JSX } from "solid-js";
import { PdslsLogo } from "../../icons/animated/brand";
import {
	type DropdownMenuCheckboxEntry,
	type DropdownMenuEntry,
	type DropdownMenuItemEntry,
	MenuEntryGroups,
} from "../DropdownMenu/DropdownMenu";
import { ContextMenu } from "./Menu";

type Maybe<T> = T | undefined | false;

export type MenuSection = {
	label?: string;
	items: Maybe<DropdownMenuEntry>[];
};

export const sectionEntries = (sections: MenuSection[]): DropdownMenuEntry[] =>
	sections.flatMap((section) => {
		const items = section.items.filter(Boolean) as DropdownMenuEntry[];
		if (items.length === 0) return [];
		return [
			section.label
				? ({ kind: "label", label: section.label } as const)
				: ({ kind: "separator" } as const),
			...items,
		];
	});

export const MarkReadIcon = CheckIcon;

export const MarkAllReadIcon = CheckReadIcon;

export type MarkReadScope = "single" | "group";

export const markReadIcon = (scope: MarkReadScope) =>
	scope === "single" ? MarkReadIcon : MarkAllReadIcon;

export const markAsReadEntry = (
	scope: MarkReadScope,
	onSelect: () => void,
): DropdownMenuItemEntry => ({
	label: "Mark as read",
	get icon() {
		const Icon = markReadIcon(scope);
		return <Icon />;
	},
	onSelect,
});

export const muteEntry = (
	noun: string,
	actions: { muted?: boolean; onMutedChange?: (muted: boolean) => void },
): DropdownMenuCheckboxEntry => ({
	kind: "checkbox",
	label: `Mute ${noun}`,
	get icon() {
		return <BellOffIcon />;
	},
	get checked() {
		return !!actions.muted;
	},
	onChange: (checked) => actions.onMutedChange?.(checked),
});

export type DeveloperMenuActions = {
	developerMode?: boolean;
	onCopyAtUri?: () => void;
	onShowOnPdsls?: () => void;
};

export const developerEntry = (
	actions: DeveloperMenuActions,
): DropdownMenuEntry | undefined => {
	if (!actions.developerMode) return undefined;
	const items = [
		actions.onCopyAtUri && {
			label: "Copy AT-URI",
			get icon() {
				return <CopyIcon />;
			},
			onSelect: actions.onCopyAtUri,
		},
		actions.onShowOnPdsls && {
			label: "Show on PDSls",
			get icon() {
				return <PdslsLogo class="size-4" />;
			},
			onSelect: actions.onShowOnPdsls,
		},
	].filter(Boolean) as DropdownMenuItemEntry[];
	if (items.length === 0) return undefined;
	return {
		kind: "submenu",
		label: "Developer mode",
		get icon() {
			return <CodeIcon />;
		},
		items,
	};
};

export type TargetContextMenuProps = {
	disabled?: boolean;
	onOpenChange?: (open: boolean) => void;
	class?: string;
	children?: JSX.Element;
};

export const EntryContextMenu = (
	props: TargetContextMenuProps & {
		label: string;
		entries: () => DropdownMenuEntry[];
	},
) => {
	const entries = createMemo(() => props.entries());
	return (
		<ContextMenu
			aria-label={props.label}
			disabled={props.disabled}
			onOpenChange={props.onOpenChange}
			class={props.class}
			menu={<MenuEntryGroups entries={entries()} />}
		>
			{props.children}
		</ContextMenu>
	);
};
