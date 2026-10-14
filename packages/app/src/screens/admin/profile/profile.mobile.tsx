import { Show } from "solid-js";
import { spaceProfile } from "./profile.contract";

export default spaceProfile.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.missing()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Missing />
						</div>
					}
				>
					<div class="flex flex-col gap-6 p-4 pb-safe-offset-6">
						<s.Images />
						<s.Fields />
						<s.Access />
					</div>
				</Show>
			</div>
		</div>
	),
});
