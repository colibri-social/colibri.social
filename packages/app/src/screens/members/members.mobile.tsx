import { Show } from "solid-js";
import { members } from "./members.contract";

export default members.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Bar />
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
					<s.Info />
					<div class="p-4 pb-safe-offset-6">
						<s.List />
					</div>
				</Show>
			</div>
		</div>
	),
});
