import { CloudCrossIcon } from "@solar-icons/solid/bold/cloud-cross";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { UnlinkIcon } from "@solar-icons/solid/bold/unlink";
import { createUniqueId, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Banner } from "../Banner/Banner";
import { Button } from "../Button/Button";
import type { DiscoveryActions } from "../Discovery/discovery-model";
import { JoinSpaceAction } from "../Discovery/SpacePreview";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { SpaceIcon } from "../Space/SpaceIcon";
import {
	isSpaceInviteCardProblem,
	SPACE_INVITE_CARD_COPY,
	type SpaceInviteCardProblem,
	type SpaceInviteCardSpace,
	type SpaceInviteCardState,
	spaceInviteCardMeta,
} from "./space-invite-card-model";

export type SpaceInviteCardProps = DiscoveryActions & {
	url: string;
	state: SpaceInviteCardState;
	space?: SpaceInviteCardSpace;
	busy?: boolean;
	onRetry?: () => void;
	class?: string;
};

const surfaceClass =
	"relative w-full max-w-[416px] overflow-hidden rounded-surface border border-border bg-card text-foreground";

const InviteMeta = (props: { space: SpaceInviteCardSpace }) => {
	const meta = () => spaceInviteCardMeta(props.space);
	return (
		<span
			data-invite-meta=""
			class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-muted-foreground"
		>
			<Show when={meta().online}>
				{(online) => (
					<span class="inline-flex items-center gap-1.5 whitespace-nowrap">
						<span aria-hidden="true" class="size-2 rounded-full bg-success" />
						{online()}
					</span>
				)}
			</Show>
			<span class="inline-flex items-center gap-1.5 whitespace-nowrap">
				<span
					aria-hidden="true"
					class="size-2 rounded-full bg-muted-foreground/60"
				/>
				{meta().members}
			</span>
		</span>
	);
};

const Eyebrow = () => (
	<span class="text-xs leading-4 font-semibold text-muted-foreground">
		{SPACE_INVITE_CARD_COPY.eyebrow}
	</span>
);

const ReadyInvite = (
	props: DiscoveryActions & {
		space: SpaceInviteCardSpace;
		busy?: boolean;
		nameId: string;
	},
) => (
	<>
		<Banner
			src={props.space.bannerSrc}
			tintFrom={props.space.iconSrc}
			color={props.space.bannerColor}
			ratio="space"
		/>
		<div class="flex flex-col gap-3 px-4 pb-4">
			<SpaceIcon
				name={props.space.name}
				src={props.space.iconSrc}
				size={64}
				class="-mt-8 border-4 border-card"
			/>
			<div class="flex min-w-0 flex-col gap-1">
				<Eyebrow />
				<h3
					id={props.nameId}
					class="truncate text-lg leading-6 font-bold text-foreground"
				>
					{props.space.name}
				</h3>
				<InviteMeta space={props.space} />
			</div>
			<Show when={props.space.description}>
				{(description) => (
					<p class="line-clamp-2 text-sm leading-prose text-pretty text-muted-foreground">
						{description()}
					</p>
				)}
			</Show>
			<JoinSpaceAction
				space={props.space}
				busy={props.busy}
				layout="stacked"
				noteAlign="center"
				onJoin={props.onJoin}
				onRequestJoin={props.onRequestJoin}
				onOpenSpace={props.onOpenSpace}
			/>
		</div>
	</>
);

const noticeIcon = (state: SpaceInviteCardProblem | "failed") => {
	if (state === "banned") return <ForbiddenCircleIcon />;
	if (state === "failed") return <CloudCrossIcon />;
	return <UnlinkIcon />;
};

const InviteNotice = (props: {
	state: SpaceInviteCardProblem | "failed";
	onRetry?: () => void;
	titleId: string;
}) => {
	const copy = () => SPACE_INVITE_CARD_COPY[props.state];
	return (
		<div class="flex flex-col gap-3 p-4">
			<div class="flex min-w-0 items-center gap-3">
				<span
					aria-hidden="true"
					class={cx(
						"flex size-12 shrink-0 items-center justify-center rounded-control bg-secondary [&>svg]:size-6",
						props.state === "banned"
							? "text-destructive"
							: "text-muted-foreground",
					)}
				>
					{noticeIcon(props.state)}
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<Eyebrow />
					<h3
						id={props.titleId}
						class="text-sm leading-5 font-semibold text-pretty text-foreground"
					>
						{copy().title}
					</h3>
					<p class="text-sm leading-5 text-pretty text-muted-foreground">
						{copy().description}
					</p>
				</div>
			</div>
			<Show when={props.state === "failed" && props.onRetry}>
				<Button
					variant="secondary"
					block
					aria-describedby={props.titleId}
					onClick={() => props.onRetry?.()}
				>
					{SPACE_INVITE_CARD_COPY.retry}
				</Button>
			</Show>
		</div>
	);
};

export const SpaceInviteCardSkeleton = (props: { class?: string }) => (
	<div
		role="status"
		aria-label={SPACE_INVITE_CARD_COPY.loading}
		data-invite-card-skeleton=""
		class={cx(surfaceClass, props.class)}
	>
		<Skeleton class="block aspect-[2/1] w-full rounded-none" />
		<div class="flex flex-col gap-3 px-4 pb-4">
			<Skeleton
				width={64}
				height={64}
				class="-mt-8 rounded-surface border-4 border-card"
			/>
			<div class="flex flex-col gap-1">
				<SkeletonText size="xs" width={72} />
				<SkeletonText size="lg" width="55%" />
				<SkeletonText size="xs" width="40%" />
			</div>
			<Skeleton class="block h-9 w-full rounded-control" />
		</div>
	</div>
);

export const SpaceInviteCard = (props: SpaceInviteCardProps) => {
	const nameId = createUniqueId();
	const notice = () => {
		if (props.state === "failed") return "failed" as const;
		if (isSpaceInviteCardProblem(props.state)) return props.state;
		return undefined;
	};
	const readySpace = () => (props.state === "ready" ? props.space : undefined);

	return (
		<Switch>
			<Match when={props.state === "loading"}>
				<SpaceInviteCardSkeleton class={props.class} />
			</Match>
			<Match when={notice()}>
				{(state) => (
					<article
						aria-labelledby={nameId}
						data-invite-card=""
						data-invite-state={state()}
						data-url={props.url}
						class={cx(surfaceClass, props.class)}
					>
						<InviteNotice
							state={state()}
							onRetry={props.onRetry}
							titleId={nameId}
						/>
					</article>
				)}
			</Match>
			<Match when={readySpace()}>
				{(space) => (
					<article
						aria-labelledby={nameId}
						data-invite-card=""
						data-invite-state="ready"
						data-url={props.url}
						class={cx(surfaceClass, props.class)}
					>
						<ReadyInvite
							space={space()}
							busy={props.busy}
							nameId={nameId}
							onJoin={props.onJoin}
							onRequestJoin={props.onRequestJoin}
							onOpenSpace={props.onOpenSpace}
						/>
					</article>
				)}
			</Match>
		</Switch>
	);
};
