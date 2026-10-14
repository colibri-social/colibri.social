import { Show } from "solid-js";
import { threads } from "./threads.contract";

export default threads.view({
	render: ({ slots: s, model: m }) => (
		<div
			data-threads-view="desktop"
			class="flex min-h-0 flex-1 flex-col bg-card"
		>
			<div class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
				<Show when={!m.unavailable()}>
					<s.Filters class="w-auto" />
				</Show>
				<div class="ml-auto">
					<s.Header platform="desktop" />
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				<Show
					when={!m.unavailable()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Unavailable />
						</div>
					}
				>
					<div
						data-threads-body=""
						class="flex min-h-full w-full flex-col px-3 py-3"
					>
						<s.List platform="desktop" />
					</div>
				</Show>
			</div>
			<s.Menu />
		</div>
	),
});
