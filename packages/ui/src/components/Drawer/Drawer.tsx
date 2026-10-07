import CorvuDrawer from "@corvu/drawer";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	type ParentProps,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

export type DrawerProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialOpen?: boolean;
	modal?: boolean;
}>;

const OPENING_SETTLE_FRAMES = 3;

export const Drawer = (props: DrawerProps) => {
	const [open, setOpen] = createSignal(
		props.open ?? props.initialOpen ?? false,
	);
	let settling = false;
	let pendingClose = false;
	let frame = 0;

	const settle = (remaining: number) => {
		frame = requestAnimationFrame(() => {
			if (remaining > 1) {
				settle(remaining - 1);
				return;
			}
			frame = 0;
			settling = false;
			if (pendingClose) {
				pendingClose = false;
				setOpen(false);
			}
		});
	};

	const apply = (next: boolean) => {
		if (next) {
			pendingClose = false;
			if (open()) return;
			setOpen(true);
			settling = true;
			if (frame) cancelAnimationFrame(frame);
			settle(OPENING_SETTLE_FRAMES);
			return;
		}
		if (settling) {
			pendingClose = true;
			return;
		}
		setOpen(false);
	};

	if (open()) {
		settling = true;
		settle(OPENING_SETTLE_FRAMES);
	}

	createEffect(
		on(
			() => props.open,
			(next) => {
				if (next !== undefined) apply(next);
			},
			{ defer: true },
		),
	);

	onCleanup(() => {
		if (frame) cancelAnimationFrame(frame);
	});

	const onOpenChange = (next: boolean) => {
		if (props.open === undefined) apply(next);
		props.onOpenChange?.(next);
	};

	return (
		<CorvuDrawer
			open={open()}
			onOpenChange={onOpenChange}
			modal={props.modal ?? true}
			side="bottom"
			velocityFunction={(distance, time) => distance / time}
		>
			{() => props.children}
		</CorvuDrawer>
	);
};

export const DrawerTrigger = CorvuDrawer.Trigger;
export const DrawerClose = CorvuDrawer.Close;

export type DrawerContentProps = {
	title?: JSX.Element;
	titleIcon?: JSX.Element;
	description?: JSX.Element;
	header?: JSX.Element;
	footer?: JSX.Element;
	class?: string;
	children?: JSX.Element;
	"aria-label"?: string;
};

export const DrawerContent = (props: DrawerContentProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"titleIcon",
		"description",
		"header",
		"footer",
		"class",
		"children",
	]);
	const context = CorvuDrawer.useContext();
	const title = createSlot(() => local.title);
	const titleIcon = createSlot(() => local.titleIcon);
	const description = createSlot(() => local.description);
	const header = createSlot(() => local.header);
	const footer = createSlot(() => local.footer);

	return (
		<CorvuDrawer.Portal>
			<CorvuDrawer.Overlay
				class="sheet-motion fixed inset-0 z-50 bg-overlay"
				style={{ opacity: context.openPercentage() }}
			/>
			<CorvuDrawer.Content
				{...rest}
				class={cx(
					"sheet-motion fixed inset-x-0 bottom-0 z-50 flex max-h-[min(90dvh,calc(100dvh-var(--safe-area-top,0px)-16px))] flex-col pl-safe pr-safe",
					"rounded-t-sheet bg-popover text-foreground outline-none",
					"after:absolute after:inset-x-0 after:top-full after:h-1/2 after:bg-inherit",
					local.class,
				)}
			>
				<div
					class={cx(
						"flex shrink-0 justify-center",
						header.has()
							? "pointer-events-none absolute inset-x-0 top-0 z-10 pt-2"
							: "pt-2 pb-3",
					)}
					aria-hidden="true"
				>
					<span
						class={cx(
							"h-1 w-10 rounded-full",
							header.has()
								? "bg-white/80 shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
								: "bg-accent",
						)}
					/>
				</div>
				<Show when={title.has()}>
					<div
						class={cx(
							"flex shrink-0 items-center gap-2 px-4 pb-6",
							header.has() && "pt-6",
						)}
					>
						<Show when={titleIcon.has()}>
							<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
								{titleIcon()}
							</span>
						</Show>
						<CorvuDrawer.Label class="truncate text-xl font-bold text-foreground">
							{title()}
						</CorvuDrawer.Label>
					</div>
				</Show>
				<Show when={description.has()}>
					<CorvuDrawer.Description class="-mt-4 shrink-0 px-4 pb-6 text-sm text-pretty text-muted-foreground">
						{description()}
					</CorvuDrawer.Description>
				</Show>
				<div
					data-drawer-scroll=""
					class={cx(
						"flex min-h-0 flex-col overflow-y-auto overscroll-contain",
						footer.has() ? "pb-4" : "pb-safe-offset-4",
						header.has() && "rounded-t-sheet",
					)}
				>
					<Show when={header.has()}>
						<div data-drawer-header="" class="shrink-0">
							{header()}
						</div>
					</Show>
					<div class={cx("flex flex-col gap-6 px-4", header.has() && "pt-6")}>
						{local.children}
					</div>
				</div>
				<Show when={footer.has()}>
					<div
						data-drawer-footer=""
						class="relative z-10 shrink-0 bg-popover px-4 pt-2 pb-safe-offset-4"
					>
						{footer()}
					</div>
				</Show>
			</CorvuDrawer.Content>
		</CorvuDrawer.Portal>
	);
};
