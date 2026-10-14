import { adminCategoryPermissions } from "./category-permissions.contract";

export default adminCategoryPermissions.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
		</>
	),
});
