import { adminChannelPermissions } from "./channel-permissions.contract";

export default adminChannelPermissions.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
			<s.Bar />
		</>
	),
});
