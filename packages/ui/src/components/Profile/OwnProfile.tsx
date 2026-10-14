import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import type { JSX, ValidComponent } from "solid-js";
import {
	type Presence,
	PresenceIndicator,
	presenceLabels,
} from "../Avatar/Avatar";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import { ListGroup, NavRow } from "../List/List";
import type { ProfileData } from "./ProfileContent";
import { ProfilePopover } from "./ProfilePopover";

export const OWN_PRESENCE_HINTS: Partial<Record<Presence, string>> = {
	dnd: "You won't get desktop notifications",
	offline: "You'll appear offline",
};

const FLYOUT_GUTTER = 24;

const presenceOption = (presence: Presence) => ({
	value: presence,
	label: presenceLabels[presence],
	description: OWN_PRESENCE_HINTS[presence],
	icon: (
		<PresenceIndicator presence={presence} size={10} class="bg-transparent" />
	),
});

export const ownPresenceEntries = (
	value: Presence,
	onSelect: (presence: Presence) => void,
): DropdownMenuEntry[] => {
	const onChange = (next: string) => onSelect(next as Presence);
	return [
		{ kind: "radio", value, onChange, options: [presenceOption("online")] },
		{ kind: "separator" },
		{
			kind: "radio",
			value,
			onChange,
			options: (["idle", "dnd", "offline"] as const).map(presenceOption),
		},
	];
};

export type OwnPresenceRowProps = {
	presence: Presence;
	entries: DropdownMenuEntry[];
};

export const OwnPresenceRow = (props: OwnPresenceRowProps) => (
	<DropdownMenu
		submenu
		placement="right-start"
		gutter={FLYOUT_GUTTER}
		label="Online status"
		items={props.entries}
		triggerAs="button"
		triggerProps={{
			type: "button",
			"aria-label": `Online status: ${presenceLabels[props.presence]}`,
			"data-own-presence-row": "",
		}}
		triggerClass="flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left text-foreground outline-none hover:bg-secondary-highlight focus-ring-inset data-expanded:bg-secondary-highlight"
		trigger={
			<>
				<span
					aria-hidden="true"
					class="flex size-6 shrink-0 items-center justify-center"
				>
					<PresenceIndicator
						presence={props.presence}
						size={10}
						class="bg-transparent"
					/>
				</span>
				<span class="min-w-0 flex-1 truncate text-sm font-semibold">
					{presenceLabels[props.presence]}
				</span>
				<AltArrowRightIcon
					aria-hidden="true"
					class="size-4 shrink-0 text-muted-foreground"
				/>
			</>
		}
	/>
);

export type OwnProfileRowsProps = {
	hasStatus: boolean;
	onEditProfile?: () => void;
	onEditStatus?: () => void;
};

export const OwnProfileRows = (props: OwnProfileRowsProps) => (
	<>
		<NavRow
			icon={<PenIcon />}
			label="Edit profile"
			chevron={false}
			onClick={() => props.onEditProfile?.()}
		/>
		<NavRow
			icon={<EmojiFunnyCircleIcon />}
			label={props.hasStatus ? "Edit status" : "Set a status"}
			chevron={false}
			onClick={() => props.onEditStatus?.()}
		/>
	</>
);

export type OwnProfilePopoverProps = {
	profile?: ProfileData;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	actions: JSX.Element;
	renderTrigger: (trigger: ValidComponent) => JSX.Element;
};

export const OwnProfilePopover = (props: OwnProfilePopoverProps) => (
	<ProfilePopover
		open={props.open}
		onOpenChange={props.onOpenChange}
		placement="top-start"
		label="Your profile"
		profile={props.profile ? { ...props.profile, self: true } : undefined}
		footer={<ListGroup>{props.actions}</ListGroup>}
		renderTrigger={props.renderTrigger}
	/>
);
