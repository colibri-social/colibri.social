import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { KeyMinimalisticIcon } from "@solar-icons/solid/bold/key-minimalistic";
import { MenuDotsVerticalIcon } from "@solar-icons/solid/bold/menu-dots-vertical";
import { createSignal, createUniqueId, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { SectionLabel } from "../List/List";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs/Tabs";
import type {
	BridgeOverviewProps,
	ConnectedBridge,
	FeaturedBridge,
} from "./BridgeOverview";
import {
	BridgeEmptyState,
	BridgeFeatureList,
	BridgeName,
} from "./FeaturedBridgeCard";

export type BridgeSplitViewProps = Omit<
	BridgeOverviewProps,
	"platform" | "loading"
>;

const featuredFor = (
	featured: readonly FeaturedBridge[],
	bridge: ConnectedBridge,
) => {
	const key = bridge.featuredId ?? bridge.id;
	return featured.find((entry) => entry.id === key);
};

const ADD_VALUE = "bridge-split-view-add";

const paneHeading = "m-0 text-2xl leading-8 font-bold text-foreground";

const DetailRow = (props: { term: string; children: JSX.Element }) => (
	<div class="grid min-h-11 grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 px-4 py-2.5">
		<dt class="text-sm text-muted-foreground">{props.term}</dt>
		<dd class="m-0 min-w-0 truncate text-sm font-semibold text-foreground select-text">
			{props.children}
		</dd>
	</div>
);

const ConnectedPane = (props: {
	bridge: ConnectedBridge;
	platform?: FeaturedBridge;
	onMenu?: (id: string, event: MouseEvent) => void;
}) => {
	const headingId = createUniqueId();
	const detailsId = createUniqueId();
	const featuresId = createUniqueId();
	return (
		<article aria-labelledby={headingId} class="flex flex-col gap-6">
			<header class="flex items-start justify-between gap-4">
				<div class="flex min-w-0 flex-col gap-1">
					<h2 id={headingId} class={paneHeading}>
						<BridgeName
							name={props.bridge.name}
							verified={props.bridge.verified}
						/>
					</h2>
					<p class="m-0 min-w-0 truncate text-sm text-muted-foreground">
						Bridged with{" "}
						<span class="font-semibold text-foreground">
							{props.bridge.bridgedWith}
						</span>
					</p>
				</div>
				<IconButton
					label={`More actions for ${props.bridge.name} bridge`}
					icon={<MenuDotsVerticalIcon />}
					onClick={(event) => props.onMenu?.(props.bridge.id, event)}
				/>
			</header>
			<section aria-labelledby={detailsId} class="flex flex-col gap-2">
				<SectionLabel id={detailsId} label="Connection" />
				<dl class="m-0 flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary">
					<DetailRow term="Bridged with">{props.bridge.bridgedWith}</DetailRow>
					<DetailRow term="Service">
						<span title={props.bridge.service}>{props.bridge.service}</span>
					</DetailRow>
					<Show when={props.platform}>
						{(platform) => (
							<DetailRow term="Made by">{platform().author}</DetailRow>
						)}
					</Show>
				</dl>
			</section>
			<Show when={props.platform}>
				{(platform) => (
					<section aria-labelledby={featuresId} class="flex flex-col gap-2">
						<SectionLabel id={featuresId} label="What this bridge can do" />
						<div class="rounded-control bg-secondary px-4 py-3">
							<BridgeFeatureList features={platform().features} />
						</div>
					</section>
				)}
			</Show>
		</article>
	);
};

const AddPane = (props: BridgeSplitViewProps) => {
	const headingId = createUniqueId();
	return (
		<section aria-labelledby={headingId} class="flex flex-col gap-6">
			<header class="flex items-start justify-between gap-4">
				<div class="flex min-w-0 flex-col gap-1">
					<h2 id={headingId} class={paneHeading}>
						Add a bridge
					</h2>
					<p class="m-0 text-sm text-pretty text-muted-foreground">
						Connect a featured bridge, or enter a code from a bridge's setup
						page.
					</p>
				</div>
				<Show when={props.onHaveCode}>
					<Button
						variant="secondary"
						icon={<KeyMinimalisticIcon />}
						onClick={() => props.onHaveCode?.()}
					>
						I have a code
					</Button>
				</Show>
			</header>
			<Show
				when={props.featured.length > 0}
				fallback={
					<BridgeEmptyState title="No featured bridges right now">
						You can still connect any bridge with a code from its setup page.
					</BridgeEmptyState>
				}
			>
				<ul
					aria-label="Featured bridges"
					class="m-0 flex list-none flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary p-0"
				>
					<For each={props.featured}>
						{(bridge) => {
							return (
								<li
									data-bridge-featured-row={bridge.id}
									class="flex items-start gap-4 p-4"
								>
									<div class="flex min-w-0 flex-1 flex-col gap-2">
										<div class="flex min-w-0 flex-col">
											<h3 class="m-0 text-base leading-6 font-bold">
												<BridgeName
													name={bridge.name}
													verified={bridge.verified}
												/>
											</h3>
											<p class="m-0 truncate text-xs text-muted-foreground">
												by{" "}
												<span class="font-semibold text-foreground">
													{bridge.author}
												</span>
											</p>
										</div>
										<BridgeFeatureList
											features={bridge.features}
											layout="wrap"
										/>
									</div>
									<Button
										loading={props.connecting === bridge.id}
										disabled={
											props.connecting !== undefined &&
											props.connecting !== bridge.id
										}
										onClick={() => props.onConnect?.(bridge.id)}
										aria-label={`${bridge.actionLabel ?? "Connect"} ${bridge.name}`}
									>
										{bridge.actionLabel ?? "Connect"}
									</Button>
								</li>
							);
						}}
					</For>
				</ul>
			</Show>
		</section>
	);
};

export const BridgeSplitView = (props: BridgeSplitViewProps) => {
	const listLabelId = createUniqueId();
	const [selected, setSelected] = createSignal<string>();
	const value = () => {
		const current = selected();
		if (current === ADD_VALUE) return ADD_VALUE;
		if (current && props.connected.some((bridge) => bridge.id === current))
			return current;
		return props.connected[0]?.id ?? ADD_VALUE;
	};

	return (
		<Tabs
			orientation="vertical"
			value={value()}
			onChange={setSelected}
			class={cx("w-full items-start gap-8", props.class)}
		>
			<div
				data-bridge-split-nav=""
				class="sticky top-0 flex w-56 shrink-0 flex-col gap-2"
			>
				<SectionLabel
					id={listLabelId}
					label="Connected"
					count={props.connected.length || undefined}
				/>
				<Show when={props.connected.length === 0}>
					<p class="m-0 px-2.5 text-sm text-muted-foreground">No bridges yet</p>
				</Show>
				<TabsList aria-label="Bridges">
					<For each={props.connected}>
						{(bridge) => (
							<TabsTrigger value={bridge.id}>
								<BridgeName name={bridge.name} verified={bridge.verified} />
							</TabsTrigger>
						)}
					</For>
					<TabsTrigger
						value={ADD_VALUE}
						class={cx(
							"text-primary-highlight hover:text-primary-highlight",
							props.connected.length > 0 &&
								"mt-3 before:pointer-events-none before:absolute before:inset-x-2.5 before:-top-2 before:h-px before:bg-border before:content-['']",
						)}
					>
						<AddCircleIcon aria-hidden="true" />
						Add a bridge
					</TabsTrigger>
				</TabsList>
			</div>
			<For each={props.connected}>
				{(bridge) => (
					<TabsContent
						value={bridge.id}
						data-bridge-split-pane=""
						class="rounded-control"
					>
						<ConnectedPane
							bridge={bridge}
							platform={featuredFor(props.featured, bridge)}
							onMenu={props.onBridgeMenu}
						/>
					</TabsContent>
				)}
			</For>
			<TabsContent
				value={ADD_VALUE}
				data-bridge-split-pane=""
				class="rounded-control"
			>
				<AddPane {...props} />
			</TabsContent>
		</Tabs>
	);
};
