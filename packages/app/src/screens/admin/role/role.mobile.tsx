import { Show } from "solid-js";
import { adminRole } from "./role.contract";

export default adminRole.view({
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
							<s.Unavailable />
						</div>
					}
				>
					<s.Loading />
					<Show when={m.ready()}>
						<div class="flex min-h-full flex-col gap-4 p-4 pb-safe-offset-6">
							<s.Locked />
							<s.Name />
							<s.Color />
							<s.Display />
							<s.Details />
							<s.Developer />
							<s.Danger />
							<s.Bar />
						</div>
					</Show>
				</Show>
			</div>
			<s.Dialogs />
		</div>
	),
});
