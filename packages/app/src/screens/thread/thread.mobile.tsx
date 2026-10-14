import { Show } from "solid-js";
import { thread } from "./thread.contract";

export default thread.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-background">
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<div class="flex min-h-0 flex-1 flex-col">
					<s.Messages />
				</div>
				<s.Composer />
			</Show>
			<s.Menu />
		</div>
	),
});
