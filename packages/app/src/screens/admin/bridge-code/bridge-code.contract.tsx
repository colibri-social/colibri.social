import { StatusScreen, TextField } from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import {
	createPairingFlow,
	PairingConfirm,
	useBridgeAdmin,
} from "../bridges/pairing";
import { AdminNavHeader } from "../desktop/page-header";

export const bridgeCode = defineContract({
	id: "adminBridgeCode",
	model: (args: AdminArgs) => {
		const bridge = useBridgeAdmin(args);
		return { ...bridge, flow: createPairingFlow(bridge, "bridge-code") };
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to New Bridge"
				onNavigate={() => m.stack.pop()}
				title="New Bridge"
				action={
					m.unavailable()
						? undefined
						: {
								type: "text",
								label: "Connect",
								disabled: !m.flow.canSubmit(),
								loading: m.flow.busy(),
								onClick: () => void m.flow.submit(),
							}
				}
			/>
		)),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(copy) => (
					<StatusScreen
						tone="destructive"
						icon={<DangerTriangleIcon />}
						title={copy().title}
						description={copy().description}
					/>
				)}
			</Show>
		)),
		Field: slot((m) => (
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void m.flow.submit();
				}}
			>
				<TextField
					label="Code or Address"
					placeholder="ABCD1234 or bolt.example.com"
					description="Enter the code the other service gave you, or the address of a bridge, like bolt.example.com."
					value={m.flow.code()}
					onChange={m.flow.setCode}
					error={m.flow.error()}
				/>
			</form>
		)),
		Confirm: slot((m) => <PairingConfirm flow={m.flow} />),
	},
});
