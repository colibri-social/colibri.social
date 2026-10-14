import { adminCategoryAudience } from "./category-audience.contract";

export default adminCategoryAudience.view({
	render: ({ slots: s }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div class="flex flex-col gap-6 p-4 pb-safe-offset-6">
					<s.Body />
				</div>
			</div>
		</div>
	),
});
