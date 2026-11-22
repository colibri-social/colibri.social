import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { CategoryMenuActions } from "../ContextMenu/CategoryMenu";
import { markReadIcon } from "../ContextMenu/menu-entries";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup, NavRow } from "../List/List";

export type CategoryDrawerProps = CategoryMenuActions & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	developer?: DeveloperModeCardProps;
};

export const CategoryDrawer = (props: CategoryDrawerProps) => {
	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const hasNotifications = () => !!(props.onMarkAsRead || props.onMutedChange);
	const hasManage = () => !!(props.onEdit || props.onCreateChannel);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={`${props.name} options`}
				header={
					<span
						data-category-drawer-header=""
						class="block min-w-0 truncate text-xl leading-7 font-bold"
					>
						{props.name}
					</span>
				}
			>
				<Show when={hasNotifications()}>
					<ListGroup>
						<Show when={props.onMarkAsRead}>
							<NavRow
								chevron={false}
								icon={<Dynamic component={markReadIcon("group")} />}
								label="Mark as read"
								onClick={run(props.onMarkAsRead)}
							/>
						</Show>
						<Show when={props.onMutedChange}>
							<NavRow
								chevron={false}
								icon={<BellOffIcon />}
								label={props.muted ? "Unmute category" : "Mute category"}
								onClick={run(() => props.onMutedChange?.(!props.muted))}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={hasManage()}>
					<ListGroup>
						<Show when={props.onEdit}>
							<NavRow
								chevron={false}
								icon={<SettingsIcon />}
								label="Edit category"
								onClick={run(props.onEdit)}
							/>
						</Show>
						<Show when={props.onCreateChannel}>
							<NavRow
								chevron={false}
								icon={<AddCircleIcon />}
								label="Create channel"
								onClick={run(props.onCreateChannel)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={props.onDelete}>
					<ListGroup>
						<DestructiveRow
							icon={<TrashBinTrashIcon />}
							label="Delete category"
							onClick={run(props.onDelete)}
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
