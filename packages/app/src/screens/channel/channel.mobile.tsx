import { Show } from "solid-js";
import { channel } from "./channel.contract";

export default channel.view({
	hidden: ["Unavailable", "LoadError"] as const,
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-background">
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<Show when={!m.loadFailure()} fallback={<s.LoadError />}>
					<div class="flex min-h-0 flex-1 flex-col">
						<s.Messages />
					</div>
					<s.Composer />
				</Show>
			</Show>
		</div>
	),
});
