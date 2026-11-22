import { inbox } from "./inbox.contract";

export default inbox.view({
	omit: ["MarkRead", "Filters", "Groups", "Modal"],
	render: ({ slots: s }) => <s.Popover />,
});
