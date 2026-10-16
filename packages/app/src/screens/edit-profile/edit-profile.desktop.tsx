import { SETTINGS_CONTENT_CLASS } from "../settings/unsaved-form";
import { editProfile } from "./edit-profile.contract";

export default editProfile.view({
	omit: ["Header"] as const,
	render: ({ slots: s }) => (
		<div data-edit-profile="desktop" class={SETTINGS_CONTENT_CLASS}>
			<div
				data-profile-card=""
				class="overflow-hidden rounded-surface border border-border pb-4"
			>
				<s.Images platform="desktop" />
			</div>
			<s.Fields platform="desktop" />
			<s.Theme platform="desktop" />
			<s.Sync />
			<s.Bar />
		</div>
	),
});
