import { createMemo, For, Index, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Loadable } from "../Skeleton/Skeleton";
import { SpaceCardSkeleton } from "../Skeleton/Skeletons";
import { SpaceCard } from "../Space/SpaceCard";
import { SearchField } from "../TextField/TextField";
import {
	type DiscoveryPlatform,
	type DiscoverySpace,
	matchesDiscoveryQuery,
} from "./discovery-model";

export type DiscoveryGridProps = {
	spaces: DiscoverySpace[];
	platform: DiscoveryPlatform;
	query: string;
	onQueryChange: (query: string) => void;
	onSelect: (space: DiscoverySpace) => void;
	loading?: boolean;
	class?: string;
};

const columnsClass: Record<DiscoveryPlatform, string> = {
	desktop: "grid-cols-[repeat(auto-fill,minmax(min(100%,256px),1fr))]",
	mobile: "grid-cols-1",
};

const SKELETON_LINES = [3, 2, 3, 2, 3, 1];

const sameIds = (a: string[], b: string[]) =>
	a.length === b.length && a.every((id, index) => id === b[index]);

export const DiscoveryGrid = (props: DiscoveryGridProps) => {
	const resultIds = createMemo(
		() =>
			props.spaces
				.filter((space) => matchesDiscoveryQuery(space, props.query))
				.map((space) => space.id),
		[],
		{ equals: sameIds },
	);
	const spaceById = (id: string) =>
		props.spaces.find((space) => space.id === id);
	const gridClass = () =>
		cx("grid min-w-0 gap-3", columnsClass[props.platform]);

	return (
		<div class={cx("flex min-w-0 flex-col gap-4", props.class)}>
			<SearchField
				placeholder="Search Spaces"
				aria-label="Search Spaces"
				value={props.query}
				onChange={props.onQueryChange}
			/>
			<Loadable
				loading={!!props.loading}
				label="Loading Spaces"
				skeleton={
					<div class={gridClass()}>
						<Index
							each={SKELETON_LINES.slice(
								0,
								props.platform === "mobile" ? 3 : 6,
							)}
						>
							{(lines) => (
								<SpaceCardSkeleton descriptionLines={lines()} class="h-full" />
							)}
						</Index>
					</div>
				}
			>
				<ul aria-label="Spaces" data-discovery-grid="" class={gridClass()}>
					<For each={resultIds()}>
						{(id) => (
							<Show when={spaceById(id)}>
								{(space) => (
									<li class="flex min-w-0" data-space-id={id}>
										<SpaceCard
											name={space().name}
											iconSrc={space().iconSrc}
											bannerSrc={space().bannerSrc}
											bannerColor={space().bannerColor}
											memberCount={space().memberCount}
											description={space().description}
											class="h-full"
											onClick={() => props.onSelect(space())}
										/>
									</li>
								)}
							</Show>
						)}
					</For>
				</ul>
				<Show when={resultIds().length === 0}>
					<p
						role="status"
						data-discovery-empty=""
						class="text-sm text-pretty text-muted-foreground"
					>
						<Show
							when={props.query.trim()}
							fallback="There are no Spaces to discover yet."
						>
							{(query) =>
								`No Spaces match "${query()}". Try a different name or topic.`
							}
						</Show>
					</p>
				</Show>
			</Loadable>
		</div>
	);
};
