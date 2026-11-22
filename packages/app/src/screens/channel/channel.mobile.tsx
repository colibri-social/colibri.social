import { Show } from "solid-js";
import { ConnectionSlot } from "../../shell/connection-slot";
import { channel } from "./channel.contract";

export default channel.view({
	hidden: ["Unavailable", "LoadError"] as const,
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-background">
			<div class="relative z-10 shrink-0 bg-background">
				<s.Header />
			</div>
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<Show when={!m.loadFailure()} fallback={<s.LoadError />}>
					<div data-keyboard-follow="" class="flex min-h-0 flex-1 flex-col">
						<div class="relative flex min-h-0 flex-1 flex-col">
							<ConnectionSlot platform="mobile" />
							<s.Messages />
						</div>
						<s.Composer />
					</div>
				</Show>
			</Show>
		</div>
	),
});
