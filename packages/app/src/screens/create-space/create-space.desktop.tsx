import { ModalContent } from "@colibri-social/ui";
import { CREATE_SPACE_COPY, createSpace } from "./create-space.contract";

export default createSpace.view({
	omit: ["Header", "Intro"] as const,
	render: ({ slots: s }) => (
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
	),
});
