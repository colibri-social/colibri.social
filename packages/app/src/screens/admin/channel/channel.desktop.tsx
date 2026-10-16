import { Show } from "solid-js";
import { adminChannel } from "./channel.contract";

export default adminChannel.view({
	omit: ["Sheets"] as const,
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
							<s.Options platform="desktop" />
							<s.LinkPreviews />
							<s.Developer />
							<s.Delete />
							<s.Bar />
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
