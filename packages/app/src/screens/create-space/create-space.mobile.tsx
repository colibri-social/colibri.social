import { createSpace } from "./create-space.contract";

export default createSpace.view({
	render: ({ slots: s }) => (
		<div
			data-create-space=""
			class="flex min-h-0 flex-1 flex-col bg-popover pt-safe text-foreground"
		>
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe-offset-6"
			>
				<s.Intro />
				<div class="flex flex-col items-center gap-6 px-4">
					<s.Images />
					<s.Fields />
					<s.Submit />
				</div>
			</div>
		</div>
	),
});
