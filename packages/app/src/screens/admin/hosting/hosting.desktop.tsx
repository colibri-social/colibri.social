import { Show } from "solid-js";
import { spaceHosting } from "./hosting.contract";

export default spaceHosting.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing() && m.allowed()} fallback={<s.Missing />}>
				<div data-admin-hosting="" class="flex flex-col gap-4">
					<s.Intro />
					<s.Status />
				</div>
			</Show>
		</>
	),
});
