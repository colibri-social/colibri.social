import { createSignal, type ParentComponent, Show } from "solid-js";
import PencilIcon from "~icons/ph/pencil";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import { MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsMobile } from "../../../utils/mobile-pane";

/**
 * Context menu for a category in the sidebar. Right-click on desktop / long-press
 * on mobile opens an "Edit" action, gated on the caller's permission check. When
 * the user can't edit, the children render plain (no menu wrapper).
 */
export const CategoryContextMenu: ParentComponent<{
	categoryName: string;
	canEdit: boolean;
	onEdit: () => void;
}> = (props) => {
	const isMobile = useIsMobile();
	const [menuOpen, setMenuOpen] = createSignal(false);

	return (
		<Show when={props.canEdit} fallback={props.children}>
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
							props.onEdit();
						}}
					>
						<PencilIcon />
						<span>Edit Category</span>
					</MenuDrawerItem>
				</MenuDrawer>
			</Show>
			<Show when={!isMobile()}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-44">
							<ContextMenuItem onClick={() => props.onEdit()}>
								<PencilIcon />
								<span>Edit Category</span>
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>
		</Show>
	);
};
