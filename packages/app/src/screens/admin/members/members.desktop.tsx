import { Show } from "solid-js";
import { members } from "./members.contract";

export default members.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Requests />
				<s.Members />
				<s.Bans />
			</Show>
			<s.Overlays />
		</>
	),
});
