import { inbox } from "./inbox.contract";

export default inbox.view({
	omit: ["MarkAll", "Filters", "Groups"],
	render: ({ slots: s }) => <s.Popover />,
});
