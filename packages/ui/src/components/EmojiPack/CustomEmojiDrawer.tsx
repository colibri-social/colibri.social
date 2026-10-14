import { createEffect, createSignal, on, Show } from "solid-js";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { AnchoredPicker } from "../EmojiPicker/EmojiPickerPopover";

export type CustomEmojiDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	src: string;
	alt?: string;
	source?: string;
	packName?: string;
	followed?: boolean;
	packFollowed?: boolean;
	onFollowChange?: (follow: boolean) => Promise<void> | void;
	onPackFollowChange?: (follow: boolean) => Promise<void> | void;
	platform?: "mobile" | "desktop";
	anchorElement?: HTMLElement;
};

type Pending = "emoji" | "pack" | undefined;

export const CustomEmojiDrawer = (props: CustomEmojiDrawerProps) => {
	const [pending, setPending] = createSignal<Pending>();
	const [failed, setFailed] = createSignal(false);

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (!open) return;
				setPending(undefined);
				setFailed(false);
			},
		),
	);

	const run = async (
		kind: Exclude<Pending, undefined>,
		action: ((follow: boolean) => Promise<void> | void) | undefined,
		follow: boolean,
	) => {
		if (!action || pending()) return;
		setPending(kind);
		setFailed(false);
		try {
			await action(follow);
		} catch {
			setFailed(true);
		} finally {
			setPending(undefined);
		}
	};

	const shortcode = () => `:${props.name}:`;

	const desktop = () => props.platform === "desktop";

	const body = () => (
		<div
			data-custom-emoji-drawer=""
			data-platform={desktop() ? "desktop" : "mobile"}
			class="flex flex-col gap-4"
		>
			<div class="flex min-w-0 flex-col items-center gap-3 pt-2 text-center">
				<img
					src={props.src}
					alt={props.alt ?? shortcode()}
					draggable={false}
					data-custom-emoji-preview=""
					class="size-24 object-contain"
				/>
				<div class="flex w-full min-w-0 flex-col gap-1">
					<span class="min-w-0 truncate text-lg leading-6 font-bold">
						{shortcode()}
					</span>
					<Show when={props.source || props.packName}>
						<span class="min-w-0 truncate text-sm text-muted-foreground">
							{[props.source, props.packName].filter(Boolean).join(" · ")}
						</span>
					</Show>
				</div>
			</div>
			<Show when={props.onFollowChange || props.onPackFollowChange}>
				<div class="flex flex-col gap-2">
					<Show when={props.onFollowChange}>
						<Button
							block
							variant={props.followed ? "secondary" : "primary"}
							loading={pending() === "emoji"}
							disabled={!!pending() && pending() !== "emoji"}
							onClick={() =>
								void run("emoji", props.onFollowChange, !props.followed)
							}
						>
							{props.followed ? "Unfollow emoji" : "Follow emoji"}
						</Button>
					</Show>
					<Show when={props.packName && props.onPackFollowChange}>
						<Button
							block
							variant="secondary"
							loading={pending() === "pack"}
							disabled={!!pending() && pending() !== "pack"}
							onClick={() =>
								void run("pack", props.onPackFollowChange, !props.packFollowed)
							}
						>
							{props.packFollowed ? "Unfollow pack" : "Follow pack"}
						</Button>
					</Show>
					<Show when={failed()}>
						<p role="alert" class="text-center text-sm text-destructive">
							Couldn't update your emoji. Try again.
						</p>
					</Show>
				</div>
			</Show>
		</div>
	);

	return (
		<Show
			when={desktop()}
			fallback={
				<Drawer open={props.open} onOpenChange={props.onOpenChange}>
					<DrawerContent aria-label={shortcode()}>{body()}</DrawerContent>
				</Drawer>
			}
		>
			<AnchoredPicker
				platform="desktop"
				open={props.open}
				onOpenChange={props.onOpenChange}
				anchorElement={props.anchorElement}
				placement="top"
				label={shortcode()}
				class="w-72 p-4"
			>
				{body()}
			</AnchoredPicker>
		</Show>
	);
};
