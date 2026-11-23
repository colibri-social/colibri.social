import { Show } from "solid-js";
import { bridgeLink } from "./bridge-link.contract";

export default bridgeLink.view({
	render: ({ slots: s, model: m }) => (
		<div
			data-admin-bridge-link=""
			class="flex min-h-0 flex-1 flex-col bg-popover"
		>
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
					<div class="flex min-h-full flex-col p-4 pb-safe-offset-6">
						<s.Step />
					</div>
				</Show>
			</div>
		</div>
	),
});
