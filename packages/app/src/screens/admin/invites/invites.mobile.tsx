import { AdminPageBody } from "../access-shared";
import { invites } from "./invites.contract";

export default invites.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<AdminPageBody missing={m.missing()} missingView={<s.Missing />}>
				<s.Invites />
			</AdminPageBody>
			<s.Overlays />
		</div>
	),
});
