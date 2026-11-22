import { Show } from "solid-js";
import { spaceHostingMove } from "./hosting-move.contract";

export default spaceHostingMove.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing() && m.allowed()} fallback={<s.Missing />}>
				<div data-admin-hosting-move="" class="flex flex-col gap-4">
					<s.Intro />
					<s.Steps />
				</div>
			</Show>
		</>
	),
});
