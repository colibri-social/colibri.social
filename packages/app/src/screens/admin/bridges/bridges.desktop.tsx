import { Show } from "solid-js";
import { bridges } from "./bridges.contract";

export default bridges.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
				<s.Intro />
				<s.List platform="desktop" />
			</Show>
			<s.Overlays platform="desktop" />
		</>
	),
});
