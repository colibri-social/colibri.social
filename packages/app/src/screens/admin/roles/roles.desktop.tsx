import { adminRoles } from "./roles.contract";

export default adminRoles.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.NameColors />
			<s.List />
		</>
	),
});
