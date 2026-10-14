import { adminRolePermissions } from "../role/role-pages";

export default adminRolePermissions.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
		</>
	),
});
