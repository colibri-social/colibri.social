import { Show } from "solid-js";
import { spaceTransfer } from "./transfer.contract";

export default spaceTransfer.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing() && m.allowed()} fallback={<s.Missing />}>
				<s.Warning />
				<s.Picker />
				<s.Confirm />
			</Show>
		</>
	),
});
