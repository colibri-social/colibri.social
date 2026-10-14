import { Show } from "solid-js";
import { thread } from "./thread.contract";

export default thread.view({
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
			<s.Menu />
		</div>
	),
});
