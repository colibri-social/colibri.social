import { CloseIcon } from "@solar-icons/solid/bold/close";
import { createMemo, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar } from "../Avatar/Avatar";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { Modal, ModalContent } from "../Modal/Modal";
import { AvatarSkeleton, SkeletonText } from "../Skeleton/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs/Tabs";

export type Reactor = {
	id: string;
	name: string;
	handle?: string;
	avatarSrc?: string;
	avatarColor?: string;
	mine?: boolean;
	via?: string;
};

export type ReactionGroup = {
	emoji: string;
	src?: string;
	name?: string;
	count: number;
	reactors: Reactor[];
	loading?: boolean;
};

export type ReactionsViewerPlatform = "mobile" | "desktop";

export type ReactionsViewerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	reactions: ReactionGroup[];
	active?: string;
	onActiveChange?: (emoji: string) => void;
	onRemove?: (emoji: string) => void;
	onOpenProfile?: (reactor: Reactor) => void;
	platform?: ReactionsViewerPlatform;
};

const MAX_SKELETON_ROWS = 6;

const ReactionGlyph = (props: { reaction: ReactionGroup; class?: string }) => (
	<Show
		when={props.reaction.src}
		fallback={
			<span aria-hidden="true" class={cx("leading-none", props.class)}>
				{props.reaction.emoji}
			</span>
		}
	>
		{(src) => (
			<AnimatedImage
				src={src()}
				alt=""
				draggable={false}
				class={cx("object-contain", props.class)}
			/>
		)}
	</Show>
);

const tabLabel = (reaction: ReactionGroup) =>
	`${reaction.name ? `:${reaction.name}:` : reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? "reaction" : "reactions"}`;

const ReactorRow = (props: {
	reactor: Reactor;
	emoji: string;
	platform: ReactionsViewerPlatform;
	onRemove?: (emoji: string) => void;
	onOpenProfile?: (reactor: Reactor) => void;
}) => {
	const desktop = () => props.platform === "desktop";
	const content = (): JSX.Element => (
		<>
			<Avatar
				aria-hidden="true"
				name={props.reactor.name}
				src={props.reactor.avatarSrc}
				color={props.reactor.avatarColor}
				size={desktop() ? "base" : "md"}
			/>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-sm font-semibold text-foreground">
					{props.reactor.name}
				</span>
				<Show when={props.reactor.via ?? props.reactor.handle}>
					{(secondary) => (
						<span class="truncate text-xs text-muted-foreground">
							{props.reactor.via ? `via ${secondary()}` : secondary()}
						</span>
					)}
				</Show>
			</span>
		</>
	);
	const interactive = () => !!props.onOpenProfile && !props.reactor.via;
	return (
		<li
			data-reactor={props.reactor.id}
			class={cx(
				"flex items-center gap-1",
				desktop() ? "h-11 rounded-control-lg" : "h-14",
			)}
		>
			<Show
				when={interactive()}
				fallback={
					<div
						class={cx(
							"flex min-w-0 flex-1 items-center gap-3",
							desktop() ? "py-1.5 pr-2 pl-1.5" : "p-2",
						)}
					>
						{content()}
					</div>
				}
			>
				<button
					type="button"
					onClick={() => props.onOpenProfile?.(props.reactor)}
					class={cx(
						"flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none",
						"hover:bg-secondary focus-ring-inset",
						desktop()
							? "rounded-control-lg py-1.5 pr-2 pl-1.5"
							: "rounded-control p-2",
					)}
				>
					{content()}
				</button>
			</Show>
			<Show when={props.reactor.mine && props.onRemove}>
				<IconButton
					variant="ghost"
					size={desktop() ? "sm" : "lg"}
					label="Remove your reaction"
					icon={<CloseIcon />}
					onClick={() => props.onRemove?.(props.emoji)}
				/>
			</Show>
		</li>
	);
};

const ReactorList = (props: {
	reaction: ReactionGroup;
	platform: ReactionsViewerPlatform;
	onRemove?: (emoji: string) => void;
	onOpenProfile?: (reactor: Reactor) => void;
}) => {
	const missing = () =>
		Math.max(0, props.reaction.count - props.reaction.reactors.length);
	const skeletons = () =>
		props.reaction.loading
			? Math.min(Math.max(missing(), 1), MAX_SKELETON_ROWS)
			: 0;
	return (
		<div class="flex flex-col">
			<ul class="flex flex-col" aria-busy={props.reaction.loading || undefined}>
				<For each={props.reaction.reactors}>
					{(reactor) => (
						<ReactorRow
							reactor={reactor}
							emoji={props.reaction.emoji}
							platform={props.platform}
							onRemove={props.onRemove}
							onOpenProfile={props.onOpenProfile}
						/>
					)}
				</For>
			</ul>
			<Show when={skeletons() > 0}>
				<div data-reactor-skeletons="" aria-hidden="true">
					<For each={Array.from({ length: skeletons() }, (_, index) => index)}>
						{() => (
							<div
								class={cx(
									"flex items-center gap-3",
									props.platform === "desktop"
										? "h-11 py-1.5 pr-2 pl-1.5"
										: "h-14 p-2",
								)}
							>
								<AvatarSkeleton
									size={props.platform === "desktop" ? "base" : "md"}
								/>
								<span class="flex flex-1 flex-col">
									<SkeletonText size="sm" width="40%" />
									<SkeletonText size="xs" width="28%" />
								</span>
							</div>
						)}
					</For>
				</div>
			</Show>
			<Show when={!props.reaction.loading && missing() > 0}>
				<p class="px-2 py-3 text-sm text-muted-foreground">
					{missing() === 1 ? "1 more person" : `${missing()} more people`}
				</p>
			</Show>
		</div>
	);
};

export const ReactionsViewer = (props: ReactionsViewerProps) => {
	const platform = () => props.platform ?? "desktop";
	const sorted = createMemo(() =>
		props.reactions.filter((reaction) => reaction.count > 0),
	);
	const active = () => {
		const list = sorted();
		const wanted = props.active;
		return (
			list.find((reaction) => reaction.emoji === wanted)?.emoji ??
			list[0]?.emoji
		);
	};

	const body = (orientation: "vertical" | "horizontal") => (
		<Tabs
			value={active()}
			onChange={(emoji) => props.onActiveChange?.(emoji)}
			orientation={orientation}
			class={orientation === "vertical" ? "h-96" : "gap-2"}
		>
			<TabsList
				aria-label="Reactions"
				class={
					orientation === "vertical"
						? "w-32 shrink-0 border-r border-border p-2"
						: "-mx-4 px-4"
				}
			>
				<For each={sorted()}>
					{(reaction) => (
						<TabsTrigger value={reaction.emoji} aria-label={tabLabel(reaction)}>
							<ReactionGlyph
								reaction={reaction}
								class={cx(
									"flex items-center justify-center",
									reaction.src ? "size-5" : "text-lg",
								)}
							/>
							<span class="tabular-nums">{reaction.count}</span>
						</TabsTrigger>
					)}
				</For>
			</TabsList>
			<For each={sorted()}>
				{(reaction) => (
					<TabsContent
						value={reaction.emoji}
						class={
							orientation === "vertical"
								? "overflow-y-auto overscroll-contain p-2"
								: undefined
						}
					>
						<ReactorList
							reaction={reaction}
							platform={platform()}
							onRemove={props.onRemove}
							onOpenProfile={props.onOpenProfile}
						/>
					</TabsContent>
				)}
			</For>
		</Tabs>
	);

	return (
		<Show
			when={platform() === "desktop"}
			fallback={
				<Drawer open={props.open} onOpenChange={props.onOpenChange}>
					<DrawerContent title="Reactions">{body("horizontal")}</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={props.open} onOpenChange={props.onOpenChange}>
				<ModalContent title="Reactions" class="md:w-[480px]">
					<div class="-mx-4 -mb-4 border-t border-border">
						{body("vertical")}
					</div>
				</ModalContent>
			</Modal>
		</Show>
	);
};
