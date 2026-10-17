import { VoiceDrawer } from "@colibri-social/ui";
import { Show } from "solid-js";
import { voiceScreen } from "./voice.contract";

export default voiceScreen.view({
	omit: ["DesktopJoin"] as const,
	render: ({ slots: s, model: m }) => (
		<VoiceDrawer
			open={m.open()}
			onOpenChange={(next) => {
				if (!next) m.close();
			}}
			joined={m.joined()}
			label={m.label()}
			header={<s.Header />}
			footer={
				<Show when={m.joined()} fallback={<s.JoinActions />}>
					<s.Controls />
				</Show>
			}
		>
			<Show when={m.joined()} fallback={<s.Roster />}>
				<s.Stage />
			</Show>
		</VoiceDrawer>
	),
});
