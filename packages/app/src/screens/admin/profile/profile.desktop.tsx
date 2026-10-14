import { Show } from "solid-js";
import { spaceProfile } from "./profile.contract";

export default spaceProfile.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<s.Images />
				<s.Fields />
				<s.Access />
			</Show>
			<s.Discard />
		</>
	),
});
