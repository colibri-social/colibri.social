import { ListGroup, ToggleRow } from "@colibri-social/ui";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";

export type SettingsArgs = { page?: "appearance" | "advanced" };

export const settings = defineContract({
	id: "settings",
	model: (_args: SettingsArgs) => {
		const data = useData();
		return { data };
	},
	slots: {
		Appearance: slot((m) => (
			<ListGroup label="Appearance">
				<ToggleRow
					title="Show message previews"
					description="Shows the latest message under each channel name."
					checked={m.data.controls().showMessagePreviews}
					onChange={(checked) =>
						m.data.setControls({ showMessagePreviews: checked })
					}
				/>
			</ListGroup>
		)),
		Controls: slot((m) => (
			<ListGroup label="Controls">
				<ToggleRow
					title="Swipe left to reply"
					description="When off, swiping left in a channel opens the member list."
					checked={m.data.controls().swipeLeftAction === "reply"}
					onChange={(checked) =>
						m.data.setControls({
							swipeLeftAction: checked ? "reply" : "members",
						})
					}
				/>
				<ToggleRow
					title="Double tap to react"
					description="Double tap a message to react with 👍."
					checked={m.data.controls().doubleTapEnabled}
					onChange={(checked) =>
						m.data.setControls({ doubleTapEnabled: checked })
					}
				/>
			</ListGroup>
		)),
		Voice: slot((m) => (
			<ListGroup label="Voice">
				<ToggleRow
					title="Confirm before joining"
					description="Clicking a voice channel opens it without joining. Use the Join voice button to connect."
					checked={m.data.controls().confirmVoiceJoin}
					onChange={(checked) =>
						m.data.setControls({ confirmVoiceJoin: checked })
					}
				/>
			</ListGroup>
		)),
		Developer: slot((m) => (
			<ListGroup label="Advanced">
				<ToggleRow
					title="Developer mode"
					description="Shows identifiers and links to inspect records on PDSls."
					checked={m.data.controls().developerMode}
					onChange={(checked) => m.data.setControls({ developerMode: checked })}
				/>
			</ListGroup>
		)),
		Simulation: slot((m) => (
			<ListGroup label="Mock data">
				<ToggleRow
					title="Slow network"
					description="Makes loading, sending and uploads five times slower."
					checked={m.data.simulation().slowNetwork}
					onChange={(checked) => m.data.setSimulation({ slowNetwork: checked })}
				/>
			</ListGroup>
		)),
	},
});
