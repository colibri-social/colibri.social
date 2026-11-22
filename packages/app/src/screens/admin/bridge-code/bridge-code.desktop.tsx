import { Show } from "solid-js";
import { bridgeCode } from "./bridge-code.contract";

export default bridgeCode.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<s.Field />
			</Show>
			<s.Confirm />
		</>
	),
});
