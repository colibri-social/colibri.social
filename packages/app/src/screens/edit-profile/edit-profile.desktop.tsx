import { editProfile } from "./edit-profile.contract";

export default editProfile.view({
	render: ({ slots: s }) => (
		<div
			data-edit-profile="desktop"
			class="-m-4 flex min-h-[calc(100%+--spacing(8))] flex-col"
		>
			<div class="flex flex-1 flex-col p-6">
				<div class="mx-auto flex w-full max-w-[600px] flex-col gap-6">
					<div class="overflow-hidden rounded-surface border border-border pb-4">
						<s.Images platform="desktop" />
					</div>
					<s.Fields platform="desktop" />
					<s.Theme platform="desktop" />
					<s.Sync />
				</div>
			</div>
			<div class="sticky -bottom-4 z-10">
				<s.Header platform="desktop" />
			</div>
			<s.Discard />
		</div>
	),
});
