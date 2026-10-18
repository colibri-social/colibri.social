import { CollapsingTitleLayout } from "@colibri-social/ui";
import { Show } from "solid-js";
import { settings } from "./settings.contract";

export default settings.view({
	render: ({ slots: s, args }) => (
		<Show
			when={args.page}
			fallback={
				<CollapsingTitleLayout
					title="Settings"
					safeTop
					contentClass="px-4 pb-28"
				>
					<div class="flex flex-col gap-6">
						<s.Index platform="mobile" />
						<s.Simulation />
					</div>
				</CollapsingTitleLayout>
			}
		>
			<div class="flex min-h-0 flex-1 flex-col bg-background">
				<s.Header />
				<div
					data-scroll-y=""
					data-settings-page={args.page}
					class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-2 pb-safe-offset-6"
				>
					<s.Page platform="mobile" />
				</div>
			</div>
		</Show>
	),
});
