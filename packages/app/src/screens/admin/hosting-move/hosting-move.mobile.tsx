import { Show } from "solid-js";
import { spaceHostingMove } from "./hosting-move.contract";

export default spaceHostingMove.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.missing() && m.allowed()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Missing />
						</div>
					}
				>
					<div
						data-admin-hosting-move=""
						class="flex flex-col gap-4 p-4 pb-safe-offset-6"
					>
						<s.Intro />
						<s.Steps />
					</div>
				</Show>
			</div>
		</div>
	),
});
