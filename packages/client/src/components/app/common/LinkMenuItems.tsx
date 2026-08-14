import { useNavigate } from "@solidjs/router";
import {
	type Accessor,
	createSignal,
	onCleanup,
	type ParentComponent,
	Show,
} from "solid-js";
import { toast } from "somoto";
import ArrowSquareOutIcon from "~icons/ph/arrow-square-out";
import LinkIcon from "~icons/ph/link-simple";
import { isTauriRuntime } from "../../../notifications/environment";
import { type LinkTarget, resolveLinkTarget } from "../../../utils/link-target";
import { openExternalLink } from "../../../utils/open-external-link";
import { useIsTouch } from "../../../utils/touch";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import { MenuDrawerItem } from "../../ui/MenuDrawer";

export const useLinkMenuActions = (
	target: Accessor<LinkTarget | undefined>,
) => {
	const navigate = useNavigate();

	const open = () => {
		const link = target();
		if (!link) return;

		if (link.kind === "internal") {
			navigate(link.href);
			return;
		}

		if (isTauriRuntime()) {
			openExternalLink(link.href);
			return;
		}

		window.open(link.href, "_blank", "noopener,noreferrer");
	};

	const copy = () => {
		const link = target();
		if (!link) return;

		void navigator.clipboard.writeText(link.copyHref);
		toast.success("Link copied to clipboard!");
	};

	return { open, copy };
};

export const LinkContextMenuItems = (props: {
	target: Accessor<LinkTarget | undefined>;
}) => {
	const { open, copy } = useLinkMenuActions(props.target);

	return (
		<Show when={props.target()}>
			<ContextMenuItem onClick={open}>
				<ArrowSquareOutIcon />
				<span>Open Link</span>
			</ContextMenuItem>
			<ContextMenuItem onClick={copy}>
				<LinkIcon />
				<span>Copy Link</span>
			</ContextMenuItem>
		</Show>
	);
};

export const LinkDrawerMenuItems = (props: {
	target: Accessor<LinkTarget | undefined>;
	onSelect: () => void;
}) => {
	const { open, copy } = useLinkMenuActions(props.target);

	return (
		<Show when={props.target()}>
			<MenuDrawerItem
				onClick={() => {
					props.onSelect();
					open();
				}}
			>
				<ArrowSquareOutIcon />
				<span>Open Link</span>
			</MenuDrawerItem>
			<MenuDrawerItem
				onClick={() => {
					props.onSelect();
					copy();
				}}
			>
				<LinkIcon />
				<span>Copy Link</span>
			</MenuDrawerItem>
		</Show>
	);
};

export const LinkContextMenu: ParentComponent<{ class?: string }> = (props) => {
	const isTouch = useIsTouch();
	const [target, setTarget] = createSignal<LinkTarget | undefined>();

	const attach = (el: HTMLElement) => {
		const onContextMenu = (event: MouseEvent) =>
			setTarget(resolveLinkTarget(event.target));

		el.addEventListener("contextmenu", onContextMenu, { capture: true });
		onCleanup(() =>
			el.removeEventListener("contextmenu", onContextMenu, { capture: true }),
		);
	};

	return (
		<Show when={!isTouch()} fallback={props.children}>
			<ContextMenu>
				<ContextMenuTrigger
					ref={attach}
					class={props.class}
					disabled={!target()}
				>
					{props.children}
				</ContextMenuTrigger>
				<ContextMenuPortal>
					<ContextMenuContent>
						<LinkContextMenuItems target={target} />
					</ContextMenuContent>
				</ContextMenuPortal>
			</ContextMenu>
		</Show>
	);
};
