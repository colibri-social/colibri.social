import { Show } from "solid-js";
import { bridgeConnect } from "./bridge-connect.contract";

export default bridgeConnect.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.blocked()} fallback={<s.Unavailable />}>
				<s.Steps />
			</Show>
			<s.Confirm />
		</>
	),
});
