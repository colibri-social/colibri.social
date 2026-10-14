import { Show } from "solid-js";
import { channel } from "./channel.contract";

export default channel.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-background">
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<div class="flex min-h-0 flex-1 flex-col">
					<s.Messages />
				</div>
				<s.Composer />
			</Show>
		</div>
	),
});
