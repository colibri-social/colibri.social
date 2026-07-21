import { type JSX, Show } from "solid-js";
import { useIsMobile } from "../../utils/mobile-pane";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "./Dialog";
import { BottomSheet } from "./MenuDrawer";
import { ScrollFadeBottom } from "./ScrollFadeBottom";

export interface ResponsiveDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: JSX.Element;
	title?: JSX.Element;
	children: JSX.Element;
	contentClass?: string;
	class?: string;
}

/**
 * Renders a centered Dialog on desktop and a bottom Drawer on mobile, sharing
 * the same controlled `open`/`onOpenChange` state and body. Use for modals that
 * should become bottom sheets on phones (creation flows, settings, etc.)
 */
export const ResponsiveDialog = (props: ResponsiveDialogProps) => {
	const isMobile = useIsMobile();

	return (
		<Show
			when={isMobile()}
			fallback={
				<Dialog open={props.open} onOpenChange={props.onOpenChange}>
					<Show when={props.trigger}>
						<DialogTrigger class={props.class}>{props.trigger}</DialogTrigger>
					</Show>
					<DialogPortal>
						<DialogContent class={props.contentClass}>
							<Show when={props.title}>
								<DialogHeader>
									<DialogTitle>{props.title}</DialogTitle>
								</DialogHeader>
							</Show>
							{props.children}
						</DialogContent>
					</DialogPortal>
				</Dialog>
			}
		>
			<Show when={props.trigger}>
				<button
					type="button"
					class={props.class}
					onClick={() => props.onOpenChange?.(true)}
				>
					{props.trigger}
				</button>
			</Show>
			<BottomSheet
				open={props.open ?? false}
				onOpenChange={props.onOpenChange ?? (() => {})}
			>
				<Show when={props.title}>
					<div class="flex flex-col gap-1.5 px-4 pt-4 pb-2">
						<h2 class="m-0 text-lg font-semibold">{props.title}</h2>
					</div>
				</Show>
				<ScrollFadeBottom class="flex flex-col gap-4 px-4 pb-[calc(1rem+var(--safe-area-bottom))]">
					{props.children}
				</ScrollFadeBottom>
			</BottomSheet>
		</Show>
	);
};
