import { Show } from "solid-js";
import { adminRole } from "./role.contract";

export default adminRole.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show when={!m.missing()} fallback={<s.Unavailable />}>
				<s.Loading />
				<Show when={m.ready()}>
					<s.Locked />
					<s.Default />
					<s.Name />
					<s.Color />
					<s.Display />
					<s.Details />
					<s.Developer />
					<s.Danger />
					<s.Bar />
				</Show>
			</Show>
			<s.Dialogs />
		</>
	),
});
