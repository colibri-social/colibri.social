import { Show } from "solid-js";
import { adminChannel } from "./channel.contract";

export default adminChannel.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.unavailable() && m.allowed()}
					fallback={
						<Show when={!m.loading()}>
							<div class="flex min-h-full flex-col">
								<s.Unavailable />
							</div>
						</Show>
					}
				>
					<div class="flex flex-col gap-6 p-4 pb-safe-offset-6">
						<Show
							when={m.creating}
							fallback={
								<>
									<s.General />
									<s.Options />
									<s.Developer />
									<s.Delete />
								</>
							}
						>
							<Show when={m.step() === 2} fallback={<s.Details />}>
								<s.Audience />
							</Show>
						</Show>
					</div>
				</Show>
			</div>
			<s.Sheets />
			<s.Discard />
		</div>
	),
});
