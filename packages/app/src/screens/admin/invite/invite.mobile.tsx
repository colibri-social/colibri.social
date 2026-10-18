import { AdminPageBody } from "../access-shared";
import { invite } from "./invite.contract";

export default invite.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<AdminPageBody missing={m.missing()} missingView={<s.Missing />}>
				<s.Body />
			</AdminPageBody>
		</div>
	),
});
