import { inbox } from "./inbox.contract";

export default inbox.view({
	omit: ["Popover", "MarkRead", "Filters", "Groups"],
	render: ({ slots: s }) => <s.Modal />,
});
