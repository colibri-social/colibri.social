import { adminRoleMembers } from "../role/role-pages";

export default adminRoleMembers.view({
	render: ({ slots: s }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div class="flex min-h-full flex-col gap-4 p-4 pb-safe-offset-6">
					<s.Body />
					<s.Bar />
				</div>
			</div>
		</div>
	),
});
