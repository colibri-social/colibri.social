import { Show } from "solid-js";
import { bridge } from "./bridge.contract";

export default bridge.view({
	render: ({ slots: s, model: m }) => (
		<div data-admin-bridge="" class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.missing() && m.allowed()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Unavailable />
						</div>
					}
				>
					<div class="flex min-h-full flex-col gap-6 p-4 pb-safe-offset-6">
						<s.Summary />
						<s.Toggles />
						<s.Links />
						<s.Danger />
					</div>
				</Show>
			</div>
		</div>
	),
});
