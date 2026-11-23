import { Show } from "solid-js";
import { bridgeLink } from "./bridge-link.contract";

export default bridgeLink.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<s.Step />
			</Show>
		</>
	),
});
