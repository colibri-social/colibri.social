import {
	CategorySkeleton,
	SpaceRail,
	spaceRailMobilePanelClass,
} from "@colibri-social/ui";
import { Show } from "solid-js";
import { spaces } from "./spaces.contract";

export default spaces.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 pt-[max(var(--safe-area-top),--spacing(2))]">
			<SpaceRail
				platform="mobile"
				onCreate={m.openCreateSpace}
				onDiscover={m.openDiscover}
			>
				<s.RailItems />
			</SpaceRail>
			<div
				data-scroll-y=""
				class={`${spaceRailMobilePanelClass} min-w-0 flex-1 overflow-y-auto overscroll-contain pb-28`}
			>
				<Show
					when={!m.missing()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Missing />
						</div>
					}
				>
					<s.Header />
					<div class="h-2" />
					<Show
						when={!m.space()?.categories.loading()}
						fallback={
							<>
								<CategorySkeleton />
								<CategorySkeleton />
							</>
						}
					>
						<s.Channels />
					</Show>
				</Show>
			</div>
		</div>
	),
});
