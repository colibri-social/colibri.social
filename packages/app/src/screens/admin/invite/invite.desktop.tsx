import { Show } from "solid-js";
import { invite } from "./invite.contract";

export default invite.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Body />
			</Show>
		</>
	),
});
