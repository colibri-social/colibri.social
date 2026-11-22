import { Show } from "solid-js";
import { invites } from "./invites.contract";

export default invites.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header platform="desktop" />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Invites platform="desktop" />
			</Show>
			<s.Overlays platform="desktop" />
		</>
	),
});
