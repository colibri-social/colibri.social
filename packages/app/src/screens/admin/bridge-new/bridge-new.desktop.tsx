import { Show } from "solid-js";
import { bridgeNew } from "./bridge-new.contract";

export default bridgeNew.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<s.Featured />
			</Show>
		</>
	),
});
