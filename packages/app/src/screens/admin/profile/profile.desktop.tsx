import { Show } from "solid-js";
import { spaceProfile } from "./profile.contract";

export default spaceProfile.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Missing />}>
				<div
					data-profile-card=""
					class="overflow-hidden rounded-surface border border-border pb-4"
				>
					<s.Images />
				</div>
				<s.Fields />
				<s.Access />
				<s.Bar />
			</Show>
		</>
	),
});
