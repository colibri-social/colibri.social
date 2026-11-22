import { Show } from "solid-js";
import { adminEmoji } from "./emoji.contract";

export default adminEmoji.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show when={!m.missing()} fallback={<s.Missing />}>
					<div class="flex min-h-full flex-col gap-6 p-4 pb-safe-offset-6">
						<s.Actions />
						<s.Search />
						<s.List />
					</div>
				</Show>
			</div>
			<s.Overlays />
		</div>
	),
});
