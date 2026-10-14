import { Show } from "solid-js";
import { adminCategory } from "./category.contract";

export default adminCategory.view({
	omit: ["Options"] as const,
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show
				when={!m.unavailable() && m.allowed()}
				fallback={
					<Show when={!m.loading()}>
						<s.Unavailable />
					</Show>
				}
			>
				<Show
					when={m.creating}
					fallback={
						<>
							<s.General />
							<s.Developer />
							<s.Delete />
						</>
					}
				>
					<Show when={m.step() === 2} fallback={<s.Details />}>
						<s.Audience />
					</Show>
				</Show>
			</Show>
		</>
	),
});
