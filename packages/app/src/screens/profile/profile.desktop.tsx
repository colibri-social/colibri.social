import { profile } from "./profile.contract";

export default profile.view({
	omit: ["Header", "Activity", "Bio", "Developer"] as const,
	render: ({ slots: s }) => (
		<>
			<s.PresencePicker platform="desktop" />
			<s.Actions platform="desktop" />
			<s.StatusEditor platform="desktop" />
		</>
	),
});
