import { Show } from "solid-js";
import { bridges } from "./bridges.contract";

export default bridges.view({
	render: ({ slots: s, model: m }) => (
		<div data-admin-bridges="" class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.unavailable()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Unavailable />
						</div>
					}
				>
					<div class="flex min-h-full flex-col gap-4 p-4 pb-safe-offset-6">
						<s.Intro />
						<s.List />
					</div>
				</Show>
			</div>
			<s.Overlays />
		</div>
	),
});
