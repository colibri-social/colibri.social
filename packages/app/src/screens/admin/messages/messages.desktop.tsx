import { Show } from "solid-js";
import { spaceMessages } from "./messages.contract";

export default spaceMessages.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Settings />
			</Show>
		</>
	),
});
