import { profile } from "./profile.contract";

export default profile.view({
	render: ({ slots: s }) => (
		<div
			data-scroll-y=""
			class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-28"
		>
			<s.Header />
			<div class="flex flex-col gap-4 px-4 pt-4">
				<s.Actions />
				<s.Bio />
				<s.Activity />
				<s.Developer />
			</div>
			<s.StatusEditor />
			<s.PresencePicker />
		</div>
	),
});
