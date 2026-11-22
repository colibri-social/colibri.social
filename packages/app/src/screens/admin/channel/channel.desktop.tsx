import { Show } from "solid-js";
import { CreateModalContent } from "../desktop/create-modal-content";
import { adminChannel } from "./channel.contract";

export default adminChannel.view({
	omit: ["Sheets"] as const,
	render: ({ slots: s, model: m }) => (
		<Show
			when={m.creating}
			fallback={
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
						<s.General />
						<s.Options platform="desktop" />
						<s.LinkPreviews />
						<s.Developer />
						<s.Delete />
						<s.Bar />
					</Show>
				</>
			}
		>
			<CreateModalContent
				title={m.createTitle()}
				step={m.step()}
				ready={m.ready()}
				saving={m.saving()}
				submitLabel={m.submitLabel()}
				onSubmit={m.submit}
				onBack={m.back}
			>
				<Show
					when={m.ready()}
					fallback={
						<Show when={!m.loading()}>
							<s.Unavailable />
						</Show>
					}
				>
					<Show when={m.step() === 2} fallback={<s.Details />}>
						<s.Audience />
					</Show>
				</Show>
			</CreateModalContent>
		</Show>
	),
});
