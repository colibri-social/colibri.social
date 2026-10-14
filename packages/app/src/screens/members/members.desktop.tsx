import { members } from "./members.contract";

export default members.view({
	omit: ["Bar", "Info", "Unavailable"],
	render: ({ slots: s }) => (
		<div
			data-members-desktop=""
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
		>
			<s.List variant="desktop" />
		</div>
	),
});
