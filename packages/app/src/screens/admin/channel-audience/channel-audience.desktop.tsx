import { adminChannelAudience } from "./channel-audience.contract";

export default adminChannelAudience.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
		</>
	),
});
