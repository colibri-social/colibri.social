import { Show } from "solid-js";
import { Outlet } from "../../shell/desktop/context";
import { voiceScreen } from "./voice.contract";

export default voiceScreen.view({
	omit: ["Roster", "JoinActions"] as const,
	hidden: ["Header", "DesktopJoin", "Stage", "Controls"] as const,
	render: ({ slots: s, model: m }) => (
		<Show when={m.pinned()}>
			<Outlet name="header">
				<s.Header platform="desktop" />
			</Outlet>
			<section
				aria-label={m.label()}
				data-voice-desktop=""
				data-joined={m.joined() ? "" : undefined}
				class="flex min-h-0 flex-1 flex-col bg-card"
			>
				<Show
					when={m.joined()}
					fallback={
						<div class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
							<s.DesktopJoin />
						</div>
					}
				>
					<div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
						<s.Stage portrait={false} shareFocus />
						<s.Controls />
					</div>
				</Show>
			</section>
		</Show>
	),
});
