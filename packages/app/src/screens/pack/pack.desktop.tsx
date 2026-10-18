import { ModalContent } from "@colibri-social/ui";
import { PACK_COPY, pack } from "./pack.contract";

export default pack.view({
	omit: ["Header"] as const,
	render: ({ slots: s }) => (
		<ModalContent title={PACK_COPY.title} class="md:w-[448px]">
			<s.Body />
		</ModalContent>
	),
});
