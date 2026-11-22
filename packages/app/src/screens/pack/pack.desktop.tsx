import { ModalContent } from "@colibri-social/ui";
import { pack } from "./pack.contract";

export default pack.view({
	omit: ["Header", "Summary"] as const,
	render: ({ slots: s, model: m }) => (
		<ModalContent
			title={m.title()}
			description={m.summary()}
			footer={m.canFollow() ? <s.Footer /> : undefined}
			class="md:w-[520px]"
		>
			<div class="-mx-4 max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain px-4">
				<s.Body />
			</div>
		</ModalContent>
	),
});
