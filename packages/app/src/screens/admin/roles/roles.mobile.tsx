import { adminRoles } from "./roles.contract";

export default adminRoles.view({
	render: ({ slots: s }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div class="flex min-h-full flex-col gap-4 p-4 pb-safe-offset-6">
					<s.NameColors />
					<s.List />
				</div>
			</div>
		</div>
	),
});
