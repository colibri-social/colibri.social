import { adminCategoryAudience } from "./category-audience.contract";

export default adminCategoryAudience.view({
	render: ({ slots: s }) => (
		<>
			<s.Header />
			<s.Body />
			<s.Bar />
		</>
	),
});
