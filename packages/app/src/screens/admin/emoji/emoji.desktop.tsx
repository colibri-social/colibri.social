import { Show } from "solid-js";
import { adminEmoji } from "./emoji.contract";

export default adminEmoji.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Actions />
				<s.Search />
				<s.List />
			</Show>
			<s.Overlays />
		</>
	),
});
