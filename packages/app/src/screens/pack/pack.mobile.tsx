import { pack } from "./pack.contract";

export default pack.view({
	render: ({ slots: s }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div class="flex min-h-full flex-col gap-4 px-4 pt-2 pb-safe-offset-6">
					<s.Summary />
					<s.Body />
					<s.Footer />
				</div>
			</div>
		</div>
	),
});
