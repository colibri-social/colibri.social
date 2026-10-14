import { threadDraft } from "./thread-draft.contract";

export default threadDraft.view({
	render: ({ slots: s }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-background">
			<s.Header />
			<div
				data-scroll-y=""
				class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3"
			>
				<s.Name />
				<s.Anchor />
			</div>
			<s.Composer />
		</div>
	),
});
