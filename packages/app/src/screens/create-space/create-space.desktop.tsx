import { ModalContent } from "@colibri-social/ui";
import { Show } from "solid-js";
import { CREATE_SPACE_COPY, createSpace } from "./create-space.contract";

export default createSpace.view({
	omit: ["Header", "Intro"] as const,
	render: ({ slots: s, model: m }) => (
		<Show
			when={!m.settingUp()}
			fallback={
				<ModalContent title={CREATE_SPACE_COPY.title} class="md:w-[440px]">
					<div data-create-space="" data-host-setup-view="">
						<s.Setup />
					</div>
				</ModalContent>
			}
		>
			<ModalContent
				title={CREATE_SPACE_COPY.title}
				description={CREATE_SPACE_COPY.description}
				class="md:w-[440px]"
				footer={<s.Submit />}
			>
				<div data-create-space="" class="flex flex-col items-center gap-6">
					<s.Images />
					<s.Fields />
				</div>
			</ModalContent>
		</Show>
	),
});
