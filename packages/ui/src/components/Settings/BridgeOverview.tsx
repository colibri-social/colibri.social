import { createUniqueId, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Card } from "../Card/Card";
import { SectionLabel } from "../List/List";
import { Skeleton, SkeletonGroup, SkeletonText } from "../Skeleton/Skeleton";
import { BridgeCardSkeleton } from "../Skeleton/Skeletons";
import { BridgeSplitView } from "./BridgeSplitView";
import {
	BridgeEmptyState,
	type BridgeFeature,
	FeaturedBridgeCard,
} from "./FeaturedBridgeCard";
import { BridgeCard } from "./Settings";

export type BridgeOverviewPlatform = "mobile" | "desktop";

export type ConnectedBridge = {
	id: string;
	featuredId?: string;
	name: string;
	verified?: boolean;
	service: string;
	bridgedWith: JSX.Element;
};

export type FeaturedBridge = {
	id: string;
	name: string;
	verified?: boolean;
	author: string;
	features: readonly BridgeFeature[];
	actionLabel?: string;
};

export type BridgeOverviewProps = {
	platform?: BridgeOverviewPlatform;
	loading?: boolean;
	connected: readonly ConnectedBridge[];
	featured: readonly FeaturedBridge[];
	connecting?: string;
	onConnect?: (id: string) => void;
	onBridgeMenu?: (id: string, event: MouseEvent) => void;
	onHaveCode?: () => void;
	class?: string;
};

const listClass = "m-0 flex list-none flex-col gap-4 p-0";

const FeaturedBridgeCardSkeleton = () => (
	<Card
		tone="secondary"
		aria-hidden="true"
		class="flex h-full flex-col gap-2 p-4"
	>
		<div class="flex flex-col gap-1">
			<SkeletonText size="xl" leading={28} width={120} />
			<SkeletonText size="xs" width={110} />
		</div>
		<div class="flex flex-1 flex-col gap-2">
			<div class="flex min-h-6 items-center gap-2">
				<Skeleton class="size-6 rounded-full" />
				<SkeletonText size="sm" width={170} />
			</div>
			<div class="flex min-h-6 items-center gap-2">
				<Skeleton class="size-6 rounded-full" />
				<SkeletonText size="sm" width={140} />
			</div>
		</div>
		<Skeleton class="h-9 w-full rounded-control" />
	</Card>
);

const DesktopSkeleton = () => (
	<SkeletonGroup label="Loading bridges" class="flex items-start gap-8">
		<div class="flex w-56 shrink-0 flex-col gap-2">
			<SkeletonText size="sm" width={84} />
			<div class="flex flex-col gap-0.5">
				<Skeleton class="h-9 w-full rounded-control-sm" />
				<Skeleton class="h-9 w-full rounded-control-sm" />
				<Skeleton class="mt-3 h-9 w-full rounded-control-sm" />
			</div>
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-6">
			<div class="flex flex-col gap-1">
				<SkeletonText size="2xl" leading={32} width={160} />
				<SkeletonText size="sm" width={220} />
			</div>
			<div class="flex flex-col gap-2">
				<SkeletonText size="sm" width={96} />
				<Skeleton class="h-33 w-full rounded-control" />
			</div>
		</div>
	</SkeletonGroup>
);

const MobileSkeleton = () => (
	<SkeletonGroup label="Loading bridges" class="flex flex-col gap-6">
		<section class="flex flex-col gap-2">
			<SkeletonText size="sm" width={84} />
			<div class="flex flex-col gap-4">
				<BridgeCardSkeleton class="h-full" />
				<BridgeCardSkeleton class="h-full" />
			</div>
		</section>
		<section class="flex flex-col gap-2">
			<SkeletonText size="sm" width={120} />
			<div class="flex flex-col gap-4">
				<FeaturedBridgeCardSkeleton />
				<FeaturedBridgeCardSkeleton />
				<FeaturedBridgeCardSkeleton />
			</div>
		</section>
	</SkeletonGroup>
);

const MobileOverview = (props: BridgeOverviewProps) => {
	const connectedId = createUniqueId();
	const featuredId = createUniqueId();

	return (
		<>
			<section aria-labelledby={connectedId} class="flex flex-col gap-2">
				<SectionLabel
					id={connectedId}
					label="Connected"
					count={props.connected.length || undefined}
				/>
				<Show
					when={props.connected.length > 0}
					fallback={
						<BridgeEmptyState title="No bridges yet">
							Connect a featured bridge below, or use a code from a bridge's
							setup page.
						</BridgeEmptyState>
					}
				>
					<ul data-bridge-grid="connected" class={listClass}>
						<For each={props.connected}>
							{(bridge) => (
								<li class="min-w-0">
									<BridgeCard
										name={bridge.name}
										verified={bridge.verified}
										service={bridge.service}
										bridgedWith={bridge.bridgedWith}
										menuLabel={`More actions for ${bridge.name} bridge`}
										onMenu={(event) => props.onBridgeMenu?.(bridge.id, event)}
										class="h-full"
									/>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</section>
			<section aria-labelledby={featuredId} class="flex flex-col gap-2">
				<SectionLabel
					id={featuredId}
					label="Featured bridges"
					action={
						props.onHaveCode
							? { label: "I have a code", onClick: props.onHaveCode }
							: undefined
					}
				/>
				<Show
					when={props.featured.length > 0}
					fallback={
						<BridgeEmptyState title="No featured bridges right now">
							You can still connect any bridge with a code from its setup page.
						</BridgeEmptyState>
					}
				>
					<ul data-bridge-grid="featured" class={listClass}>
						<For each={props.featured}>
							{(bridge) => (
								<li class="min-w-0">
									<FeaturedBridgeCard
										name={bridge.name}
										verified={bridge.verified}
										author={bridge.author}
										features={bridge.features}
										actionLabel={bridge.actionLabel}
										actionLoading={props.connecting === bridge.id}
										actionDisabled={
											props.connecting !== undefined &&
											props.connecting !== bridge.id
										}
										onAction={() => props.onConnect?.(bridge.id)}
										class="h-full"
									/>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</section>
		</>
	);
};

export const BridgeOverview = (props: BridgeOverviewProps) => {
	const platform = () => props.platform ?? "mobile";

	return (
		<div
			data-bridge-overview=""
			data-platform={platform()}
			class={cx("flex w-full flex-col gap-6", props.class)}
		>
			<Show
				when={!props.loading}
				fallback={
					<Show when={platform() === "desktop"} fallback={<MobileSkeleton />}>
						<DesktopSkeleton />
					</Show>
				}
			>
				<Show
					when={platform() === "desktop"}
					fallback={<MobileOverview {...props} />}
				>
					<BridgeSplitView
						connected={props.connected}
						featured={props.featured}
						connecting={props.connecting}
						onConnect={props.onConnect}
						onBridgeMenu={props.onBridgeMenu}
						onHaveCode={props.onHaveCode}
					/>
				</Show>
			</Show>
		</div>
	);
};
