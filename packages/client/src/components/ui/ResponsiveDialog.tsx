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
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
	DrawerTrigger,
} from "./Drawer";

export interface ResponsiveDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: JSX.Element;
	title?: JSX.Element;
	children: JSX.Element;
	contentClass?: string;
	mobileBreakPoints?: number[];
	class: string;
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
			<Drawer
				open={props.open}
				onOpenChange={props.onOpenChange}
				breakPoints={props.mobileBreakPoints}
			>
				<Show when={props.trigger}>
					<DrawerTrigger class={props.class}>{props.trigger}</DrawerTrigger>
				</Show>
				<DrawerPortal>
					<DrawerContent class="max-h-[85dvh]">
						<Show when={props.title}>
							<DrawerHeader class="pb-2">
								<DrawerLabel class="m-0 text-lg font-semibold">
									{props.title}
								</DrawerLabel>
							</DrawerHeader>
						</Show>
						<div class="flex flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
							{props.children}
						</div>
					</DrawerContent>
				</DrawerPortal>
			</Drawer>
		</Show>
	);
};
