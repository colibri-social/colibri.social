import { createSignal, type ParentComponent, Show } from "solid-js";
import ChecksIcon from "~icons/ph/checks";
import PencilIcon from "~icons/ph/pencil";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import { MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";

/**
 * Context menu for a category in the sidebar. Right-click on desktop / long-press
 * on mobile. "Mark all as read" is available to every member, "Edit Category" is
 * gated on the caller's permission check and, when present, sits below a separator.
 */
export const CategoryContextMenu: ParentComponent<{
	categoryName: string;
	canEdit: boolean;
	onEdit: () => void;
	onMarkAllRead: () => void;
}> = (props) => {
	const isMobile = useIsMobile();
	const [menuOpen, setMenuOpen] = createSignal(false);

	return (
		<>
			<Show when={isMobile()}>
				<div
					style={{ display: "contents" }}
					ref={(el) =>
						createLongPress(el, {
							enabled: () => isMobile(),
							onLongPress: () => setMenuOpen(true),
						})
					}
				>
					{props.children}
				</div>
				<MenuDrawer
					open={menuOpen()}
					onOpenChange={setMenuOpen}
					title={props.categoryName}
				>
					<MenuDrawerItem
						onClick={() => {
							setMenuOpen(false);
							props.onMarkAllRead();
						}}
					>
						<ChecksIcon />
						<span>Mark all as read</span>
					</MenuDrawerItem>
					<Show when={props.canEdit}>
						<MenuDrawerItem
							onClick={() => {
								setMenuOpen(false);
								props.onEdit();
							}}
						>
							<PencilIcon />
							<span>Edit Category</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
			</Show>
			<Show when={!isMobile()}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-44">
							<ContextMenuItem onClick={() => props.onMarkAllRead()}>
								<ChecksIcon />
								<span>Mark all as read</span>
							</ContextMenuItem>
							<Show when={props.canEdit}>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => props.onEdit()}>
									<PencilIcon />
									<span>Edit Category</span>
								</ContextMenuItem>
							</Show>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>
		</>
	);
};
