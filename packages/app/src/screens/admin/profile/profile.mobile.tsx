import { Show } from "solid-js";
import { spaceProfile } from "./profile.contract";

export default spaceProfile.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-safe-offset-6"
			>
				<Show
					when={!m.missing()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Missing />
						</div>
					}
				>
					<s.Images />
					<div class="flex flex-1 flex-col gap-6 px-4 pt-4">
						<s.Fields />
						<s.Access />
						<s.Bar />
					</div>
				</Show>
			</div>
		</div>
	),
});
