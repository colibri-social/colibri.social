import { AdminPageBody } from "../access-shared";
import { members } from "./members.contract";

export default members.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<AdminPageBody missing={m.missing()} missingView={<s.Missing />}>
				<s.Requests />
				<s.Members />
				<s.Bans />
			</AdminPageBody>
			<s.Overlays />
		</div>
	),
});
