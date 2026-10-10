import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { VerifiedCheckIcon } from "@solar-icons/solid/bold/verified-check";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import { CircleDashedIcon } from "@solar-icons/solid/linear/circle-dashed";
import { CloseIcon } from "@solar-icons/solid/linear/close";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";

export type BridgeFeatureSupport = "full" | "partial" | "none";

export type BridgeFeature = {
	label: JSX.Element;
	support: BridgeFeatureSupport;
};

export type FeaturedBridgeCardProps = {
	name: string;
	verified?: boolean;
	author: string;
	features: readonly BridgeFeature[];
	actionLabel?: string;
	onAction?: () => void;
	actionLoading?: boolean;
	actionDisabled?: boolean;
	class?: string;
};

const SUPPORT_LABEL: Record<BridgeFeatureSupport, string> = {
	full: "Supported",
	partial: "Partly supported",
	none: "Not supported",
};

const SupportIcon = (props: {
	support: BridgeFeatureSupport;
	size?: "sm" | "md";
}) => (
	<span
		aria-hidden="true"
		data-bridge-feature-icon={props.support}
		class={cx(
			"flex shrink-0 items-center justify-center",
			props.size === "sm" ? "size-4 [&>svg]:size-4" : "size-6 [&>svg]:size-6",
			props.support === "full" && "text-success",
			props.support === "partial" && "text-warning",
			props.support === "none" && "text-destructive",
		)}
	>
		<Switch>
			<Match when={props.support === "full"}>
				<CheckIcon strokeWidth={1.5} />
			</Match>
			<Match when={props.support === "partial"}>
				<CircleDashedIcon strokeWidth={1.5} />
			</Match>
			<Match when={props.support === "none"}>
				<CloseIcon strokeWidth={1.5} />
			</Match>
		</Switch>
	</span>
);

export type BridgeFeatureListProps = {
	features: readonly BridgeFeature[];
	layout?: "stack" | "wrap";
	class?: string;
};

export const BridgeFeatureList = (props: BridgeFeatureListProps) => (
	<ul
		class={cx(
			"m-0 list-none p-0",
			props.layout === "wrap"
				? "flex flex-wrap gap-x-4 gap-y-1"
				: "flex flex-col gap-2",
			props.class,
		)}
	>
		<For each={props.features}>
			{(feature) => (
				<li
					class={cx(
						"flex min-h-6 min-w-0 items-center",
						props.layout === "wrap" ? "gap-1.5" : "gap-2",
					)}
				>
					<SupportIcon
						support={feature.support}
						size={props.layout === "wrap" ? "sm" : "md"}
					/>
					<span class="sr-only">{SUPPORT_LABEL[feature.support]}: </span>
					<span class="min-w-0 flex-1 text-sm text-foreground">
						{feature.label}
					</span>
				</li>
			)}
		</For>
	</ul>
);

export type BridgeNameProps = {
	name: string;
	verified?: boolean;
	class?: string;
};

export const BridgeName = (props: BridgeNameProps) => (
	<span class={cx("flex min-w-0 items-center gap-1.5", props.class)}>
		<span class="min-w-0 truncate">{props.name}</span>
		<Show when={props.verified}>
			<VerifiedCheckIcon
				class="size-[1.15em] shrink-0 text-primary"
				aria-label="Verified"
				role="img"
			/>
		</Show>
	</span>
);

export type BridgeEmptyStateProps = {
	title: string;
	children: JSX.Element;
	class?: string;
};

export const BridgeEmptyState = (props: BridgeEmptyStateProps) => (
	<div
		data-bridge-empty=""
		class={cx(
			"flex flex-col items-center gap-2 rounded-control border border-dashed border-control-border px-4 py-6 text-center",
			props.class,
		)}
	>
		<span class="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
			<TransferHorizontalIcon aria-hidden="true" />
		</span>
		<p class="m-0 text-sm font-semibold text-foreground">{props.title}</p>
		<p class="m-0 max-w-80 text-sm text-pretty text-muted-foreground">
			{props.children}
		</p>
	</div>
);

export const FeaturedBridgeCard = (props: FeaturedBridgeCardProps) => (
	<Card
		tone="secondary"
		data-featured-bridge=""
		class={cx("flex flex-col gap-2 p-4", props.class)}
	>
		<div class="flex flex-col gap-1">
			<h3 class="m-0 flex min-w-0 items-center gap-2">
				<span class="min-w-0 truncate text-xl leading-7 font-bold">
					{props.name}
				</span>
				<Show when={props.verified}>
					<VerifiedCheckIcon
						class="size-6 shrink-0 text-primary"
						aria-label="Verified"
						role="img"
					/>
				</Show>
			</h3>
			<p class="m-0 min-w-0 truncate text-xs text-muted-foreground">
				by{" "}
				<span class="font-bold text-foreground select-text">
					{props.author}
				</span>
			</p>
		</div>
		<BridgeFeatureList features={props.features} class="flex-1" />
		<Button
			block
			class="h-9"
			loading={props.actionLoading}
			disabled={props.actionDisabled}
			onClick={() => props.onAction?.()}
			aria-label={`${props.actionLabel ?? "Connect"} ${props.name}`}
		>
			{props.actionLabel ?? "Connect"}
		</Button>
	</Card>
);
