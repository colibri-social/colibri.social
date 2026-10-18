import { Show } from "solid-js";
import { bridge } from "./bridge.contract";

export default bridge.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing() && m.allowed()} fallback={<s.Unavailable />}>
				<s.Summary />
				<s.Toggles />
				<s.Links />
				<s.Danger />
				<s.Bar />
			</Show>
		</>
	),
});
