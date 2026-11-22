import { legacySpaceTitle, ModalContent } from "@colibri-social/ui";
import { legacySpace } from "./legacy-space.contract";

export default legacySpace.view({
	omit: ["Header"] as const,
	render: ({ slots: s, model: m }) => (
		<ModalContent
			title={legacySpaceTitle(
				m.variant() ?? "blocked",
				m.entry()?.name ?? "This community",
			)}
			class="md:w-[440px]"
		>
			<s.Body showTitle={false} class="px-0 py-2" />
		</ModalContent>
	),
});
