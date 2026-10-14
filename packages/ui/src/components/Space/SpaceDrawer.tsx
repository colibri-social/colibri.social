import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { AddFolderIcon } from "@solar-icons/solid/bold/add-folder";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { SortVerticalIcon } from "@solar-icons/solid/bold/sort-vertical";
import { UserPlusRoundedIcon } from "@solar-icons/solid/bold/user-plus-rounded";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { ActionTile, ActionTiles } from "../Channels/ChannelListHeader";
import { markReadIcon } from "../ContextMenu/menu-entries";
import type { SpaceContextMenuActions } from "../ContextMenu/SpaceMenu";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup, NavRow, ToggleRow } from "../List/List";
import { SpaceProfileHeader } from "./SpaceProfileHeader";

export type SpaceDrawerProps = SpaceContextMenuActions & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	iconSrc?: string;
	bannerSrc?: string;
	bannerColor?: string;
	memberCount: number;
	memberLabel?: string;
	ownerHandle?: string;
	description?: string;
	developer?: DeveloperModeCardProps;
};

export const SpaceDrawer = (props: SpaceDrawerProps) => {
	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const tileCount = () =>
		[
			props.onInvite,
			props.onOpenNotificationSettings,
			props.onOpenSettings,
		].filter(Boolean).length;
	const hasTiles = () => tileCount() > 1;
	const loneTile = () => tileCount() === 1;
	const notificationRow = () =>
		loneTile() && !!props.onOpenNotificationSettings;
	const hasNotifications = () =>
		!!(props.onMarkAsRead || props.onMutedChange || notificationRow());
	const hasChannels = () =>
		!!(
			props.onCreateChannel ||
			props.onCreateCategory ||
			props.onReorderChannels
		);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={props.name}
				headerBleed
				header={
					<SpaceProfileHeader
						name={props.name}
						iconSrc={props.iconSrc}
						bannerSrc={props.bannerSrc}
						bannerColor={props.bannerColor}
						memberCount={props.memberCount}
						memberLabel={props.memberLabel}
						ownerHandle={props.ownerHandle}
						description={props.description}
					/>
				}
			>
				<Show when={hasTiles()}>
					<ActionTiles>
						<Show when={props.onInvite}>
							<ActionTile
								icon={<UserPlusRoundedIcon />}
								label="Invite"
								onClick={run(props.onInvite)}
							/>
						</Show>
						<Show when={props.onOpenNotificationSettings}>
							<ActionTile
								icon={<BellIcon />}
								label="Notifications"
								onClick={run(props.onOpenNotificationSettings)}
							/>
						</Show>
						<Show when={props.onOpenSettings}>
							<ActionTile
								icon={<SettingsIcon />}
								label="Settings"
								onClick={run(props.onOpenSettings)}
							/>
						</Show>
					</ActionTiles>
				</Show>
				<Show when={loneTile() && (props.onInvite || props.onOpenSettings)}>
					<ListGroup>
						<Show when={props.onInvite}>
							<NavRow
								icon={<UserPlusRoundedIcon />}
								label="Invite people"
								onClick={run(props.onInvite)}
							/>
						</Show>
						<Show when={props.onOpenSettings}>
							<NavRow
								icon={<SettingsIcon />}
								label="Space settings"
								onClick={run(props.onOpenSettings)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={hasNotifications()}>
					<ListGroup>
						<Show when={notificationRow()}>
							<NavRow
								icon={<BellIcon />}
								label="Notification settings"
								onClick={run(props.onOpenNotificationSettings)}
							/>
						</Show>
						<Show when={props.onMarkAsRead}>
							<NavRow
								icon={<Dynamic component={markReadIcon("group")} />}
								label="Mark as read"
								onClick={run(props.onMarkAsRead)}
							/>
						</Show>
						<Show when={props.onMutedChange}>
							<ToggleRow
								icon={<BellOffIcon />}
								title="Mute Space"
								checked={!!props.muted}
								onChange={(checked) => props.onMutedChange?.(checked)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={hasChannels()}>
					<ListGroup>
						<Show when={props.onCreateChannel}>
							<NavRow
								icon={<AddCircleIcon />}
								label="Create channel"
								onClick={run(props.onCreateChannel)}
							/>
						</Show>
						<Show when={props.onCreateCategory}>
							<NavRow
								icon={<AddFolderIcon />}
								label="Create category"
								onClick={run(props.onCreateCategory)}
							/>
						</Show>
						<Show when={props.onReorderChannels}>
							<NavRow
								icon={<SortVerticalIcon />}
								label="Reorder channels"
								onClick={run(props.onReorderChannels)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={props.onLeave}>
					<ListGroup>
						<DestructiveRow
							icon={<Logout2Icon />}
							label="Leave Space"
							onClick={run(props.onLeave)}
						/>
					</ListGroup>
				</Show>
				<Show when={props.developerMode && props.developer}>
					{(developer) => <DeveloperModeCard {...developer()} />}
				</Show>
			</DrawerContent>
		</Drawer>
	);
};
