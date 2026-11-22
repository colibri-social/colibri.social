import { adminRoleMembers } from "../role/role-pages";

export default adminRoleMembers.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
			<s.Bar />
		</>
	),
});
