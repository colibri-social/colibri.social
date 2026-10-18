import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import type { BannerRatio } from "../Banner/Banner";
import { Card, type CardTone } from "../Card/Card";
import { MessagePreviewSkeleton } from "../Message/MessageSkeletons";
import type { ProfileSurface } from "../Profile/Profile";
import type { SpaceIconSize } from "../Space/SpaceIcon";
import { AvatarSkeleton, Skeleton, SkeletonText } from "./Skeleton";

const surfaceColor: Record<ProfileSurface, string> = {
	background: "var(--background)",
	popover: "var(--popover)",
};

export type BannerSkeletonProps = {
	ratio?: BannerRatio;
	class?: string;
};

export const BannerSkeleton = (props: BannerSkeletonProps) => (
	<Skeleton
		class={cx(
			"w-full rounded-none",
			(props.ratio ?? "space") === "user" ? "aspect-[3/1]" : "aspect-[2/1]",
			props.class,
		)}
	/>
);

export type SpaceIconSkeletonProps = {
	size?: SpaceIconSize;
	class?: string;
};

export const SpaceIconSkeleton = (props: SpaceIconSkeletonProps) => (
	<Skeleton
		class={cx(
			(props.size ?? 48) === 64
				? "size-16 rounded-surface"
				: "size-12 rounded-control",
			props.class,
		)}
	/>
);

export type ChipSkeletonProps = {
	width?: number;
	class?: string;
};

export const ChipSkeleton = (props: ChipSkeletonProps) => (
	<Skeleton
		class={cx("h-6 rounded-control-xs", props.class)}
		width={props.width ?? 104}
	/>
);

export type SpaceCardSkeletonProps = {
	descriptionLines?: number;
	class?: string;
};

export const SpaceCardSkeleton = (props: SpaceCardSkeletonProps) => (
	<Card tone="card" aria-hidden="true" class={props.class}>
		<BannerSkeleton ratio="space" />
		<span class="flex flex-col gap-3 p-3">
			<span class="flex min-w-0 items-center gap-3">
				<SpaceIconSkeleton />
				<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
					<SkeletonText size="xl" leading={26} width="58%" class="w-full" />
					<ChipSkeleton />
				</span>
			</span>
			<Show when={(props.descriptionLines ?? 3) > 0}>
				<SkeletonText size="base" lines={props.descriptionLines ?? 3} />
			</Show>
		</span>
	</Card>
);

export type SpaceProfileHeaderSkeletonProps = {
	owner?: boolean;
	descriptionLines?: number;
	actions?: boolean;
	class?: string;
};

export const SpaceProfileHeaderSkeleton = (
	props: SpaceProfileHeaderSkeletonProps,
) => (
	<div aria-hidden="true" class={cx("flex flex-col", props.class)}>
		<BannerSkeleton ratio="space" />
		<div class="relative -mt-8 px-3">
			<span class="flex size-16 rounded-surface border-4 border-popover bg-popover">
				<Skeleton class="size-full rounded-control-sm" />
			</span>
		</div>
		<div class="flex flex-col gap-4 px-4 pt-4">
			<div class="flex flex-col gap-2">
				<SkeletonText size="xl" leading={26} width="55%" />
				<div class="flex min-w-0 flex-wrap items-center gap-2">
					<ChipSkeleton />
					<Show when={props.owner ?? true}>
						<ChipSkeleton width={120} />
					</Show>
				</div>
				<Show when={(props.descriptionLines ?? 3) > 0}>
					<SkeletonText size="base" lines={props.descriptionLines ?? 3} />
				</Show>
			</div>
			<Show when={props.actions ?? true}>
				<div class="flex flex-col gap-2">
					<Skeleton class="h-9 w-full rounded-control" />
				</div>
			</Show>
		</div>
	</div>
);

export type InboxGroupCardSkeletonProps = {
	rows?: number;
	lines?: number[];
	class?: string;
};

export const InboxGroupCardSkeleton = (props: InboxGroupCardSkeletonProps) => (
	<Card tone="card" aria-hidden="true" class={cx("flex flex-col", props.class)}>
		<div class="flex items-center gap-3 p-3">
			<SpaceIconSkeleton />
			<div class="flex min-w-0 flex-1 flex-col">
				<SkeletonText size="xl" leading={26} width="60%" />
				<SkeletonText size="sm" leading={18} width="28%" />
			</div>
		</div>
		<For
			each={
				props.lines ??
				Array.from({ length: props.rows ?? 2 }, (_, i) => (i % 2 === 0 ? 1 : 2))
			}
		>
			{(lines) => (
				<>
					<div class="h-px shrink-0 bg-border" />
					<MessagePreviewSkeleton lines={lines} />
				</>
			)}
		</For>
	</Card>
);

export type StatusBubbleSkeletonProps = {
	lines?: number;
	class?: string;
};

export const StatusBubbleSkeleton = (props: StatusBubbleSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx(
			"flex min-w-0 items-start gap-2 rounded-control border border-border bg-secondary px-2 py-1",
			props.class,
		)}
	>
		<SkeletonText
			size="sm"
			leading={18}
			lines={props.lines ?? 2}
			class="flex-1"
		/>
	</div>
);

export type ProfileHeaderSkeletonProps = {
	surface?: ProfileSurface;
	status?: boolean;
	class?: string;
};

export const ProfileHeaderSkeleton = (props: ProfileHeaderSkeletonProps) => {
	const surface = () => surfaceColor[props.surface ?? "background"];
	return (
		<div
			aria-hidden="true"
			class={cx("relative flex w-full flex-col", props.class)}
		>
			<BannerSkeleton ratio="user" />
			<div class="relative -mt-12 flex items-start gap-3 pr-4 pl-3">
				<span
					class="flex shrink-0 rounded-full p-1"
					style={{ "background-color": surface() }}
				>
					<AvatarSkeleton size="xl" />
				</span>
				<Show when={props.status}>
					<StatusBubbleSkeleton class="mt-[34px] flex-1" />
				</Show>
			</div>
			<div class="flex min-w-0 flex-col gap-1 px-4 pt-2.5">
				<div class="flex min-w-0 items-center gap-2">
					<SkeletonText size="2xl" leading={31} width={132} />
				</div>
				<div class="flex min-h-6 min-w-0 items-center gap-2">
					<SkeletonText size="sm" leading={18} width={150} />
				</div>
			</div>
		</div>
	);
};

export type NowPlayingCardSkeletonProps = {
	tone?: CardTone;
	class?: string;
};

export const NowPlayingCardSkeleton = (props: NowPlayingCardSkeletonProps) => (
	<Card
		tone={props.tone}
		aria-hidden="true"
		class={cx("flex flex-col gap-2 p-3", props.class)}
	>
		<SkeletonText size="xs" leading={16} width={140} />
		<span class="flex min-w-0 items-center gap-3">
			<Skeleton class="size-18 rounded-badge" />
			<span class="flex min-w-0 flex-1 flex-col gap-1">
				<SkeletonText size="base" leading={21} width="64%" />
				<span class="flex min-w-0 flex-col gap-0.5">
					<SkeletonText size="xs" leading={16} width="32%" />
					<SkeletonText size="xs" leading={16} width="48%" />
				</span>
			</span>
		</span>
	</Card>
);

const InfoRowSkeleton = (props: { labelWidth: number; valueWidth: number }) => (
	<div class="flex min-h-6 min-w-0 items-center gap-2">
		<Skeleton class="size-6 rounded-full" />
		<SkeletonText size="base" width={props.labelWidth} />
		<SkeletonText size="base" width={props.valueWidth} />
	</div>
);

const MenuButtonSkeleton = (props: { class?: string }) => (
	<Skeleton class={cx("size-7 rounded-control-sm", props.class)} />
);

export type InviteCardSkeletonProps = {
	class?: string;
};

export const InviteCardSkeleton = (props: InviteCardSkeletonProps) => (
	<div aria-hidden="true" class={cx("relative w-full", props.class)}>
		<Card tone="secondary" class="flex flex-col gap-2 p-4">
			<span class="flex h-7 min-w-0 items-center gap-2 pr-9">
				<SkeletonText size="xl" leading={20} width={150} />
			</span>
			<InfoRowSkeleton labelWidth={78} valueWidth={52} />
			<div class="flex min-h-6 min-w-0 items-center gap-2">
				<Skeleton class="size-6 rounded-full" />
				<SkeletonText size="base" width={84} />
				<AvatarSkeleton size="xs" />
				<SkeletonText size="sm" width={110} />
			</div>
			<InfoRowSkeleton labelWidth={40} valueWidth={24} />
		</Card>
		<MenuButtonSkeleton class="absolute top-[17px] right-[17px]" />
	</div>
);

export type BridgeCardSkeletonProps = {
	class?: string;
};

export const BridgeCardSkeleton = (props: BridgeCardSkeletonProps) => (
	<Card
		tone="secondary"
		aria-hidden="true"
		class={cx("flex flex-col gap-2 p-4", props.class)}
	>
		<div class="flex flex-col gap-1">
			<div class="flex min-w-0 items-center justify-between gap-2">
				<SkeletonText size="xl" leading={28} width={110} />
				<MenuButtonSkeleton />
			</div>
			<div class="flex min-w-0 items-center gap-2">
				<SkeletonText size="xs" width={44} />
				<SkeletonText size="xs" width={190} />
			</div>
		</div>
		<InfoRowSkeleton labelWidth={100} valueWidth={96} />
	</Card>
);

export type EmojiRowSkeletonProps = {
	uploader?: boolean;
	class?: string;
};

export const EmojiRowSkeleton = (props: EmojiRowSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx("flex h-10 w-full items-center gap-2 px-3", props.class)}
	>
		<Skeleton class="size-6 rounded-badge" />
		<span class="flex min-w-0 flex-1">
			<SkeletonText size="sm" width={72} />
		</span>
		<Show when={props.uploader ?? true}>
			<SkeletonText size="xs" width={84} />
			<Skeleton class="size-4 rounded-full" />
		</Show>
		<span class="-mx-1.5 flex size-7 shrink-0 items-center justify-center">
			<Skeleton class="h-4 w-1 rounded-full" />
		</span>
	</div>
);

export type NavRowSkeletonProps = {
	icon?: boolean;
	value?: boolean;
	labelWidth?: number | string;
	class?: string;
};

export const NavRowSkeleton = (props: NavRowSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx("flex h-10 w-full shrink-0 items-center gap-2 px-3", props.class)}
	>
		<Show when={props.icon ?? true}>
			<Skeleton class="size-6 rounded-control-xs" />
		</Show>
		<span class="flex min-w-0 flex-1">
			<SkeletonText
				size="sm"
				width={props.labelWidth ?? "42%"}
				class="w-full"
			/>
		</span>
		<Show when={props.value}>
			<SkeletonText size="xs" width={56} />
		</Show>
		<Skeleton class="size-4 rounded-full" />
	</div>
);

export type ToggleRowSkeletonProps = {
	description?: boolean;
	class?: string;
};

export const ToggleRowSkeleton = (props: ToggleRowSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx("flex w-full shrink-0 px-3 py-2", props.class)}
	>
		<div class="flex w-full items-center justify-between gap-4">
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<SkeletonText size="sm" width="46%" />
				<Show when={props.description ?? true}>
					<SkeletonText size="xs" width="72%" />
				</Show>
			</div>
			<Skeleton class="h-[22px] w-[42px] rounded-full" />
		</div>
	</div>
);

export type CheckboxRowSkeletonProps = {
	avatar?: boolean;
	class?: string;
};

export const CheckboxRowSkeleton = (props: CheckboxRowSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx(
			"flex min-h-14 w-full shrink-0 items-center gap-3 px-3 py-2",
			props.class,
		)}
	>
		<Show when={props.avatar ?? true}>
			<AvatarSkeleton size="md" />
		</Show>
		<div class="flex min-w-0 flex-1 items-center justify-between gap-4">
			<SkeletonText size="base" width="44%" class="flex-1" />
			<Skeleton class="size-6 rounded-checkbox" />
		</div>
	</div>
);
