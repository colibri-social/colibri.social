import { legacySpace } from "./legacy-space.contract";

export default legacySpace.view({
	render: ({ slots: s }) => (
		<div
			data-legacy-space-screen=""
			class="flex min-h-0 flex-1 flex-col bg-popover pt-safe text-foreground"
		>
			<s.Header />
			<div
				data-scroll-y=""
				class="flex min-h-0 flex-1 flex-col justify-center-safe overflow-y-auto overscroll-contain pb-safe-offset-6"
			>
				<s.Body />
			</div>
		</div>
	),
});
