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
		return { ...bridge, flow: createPairingFlow(bridge) };
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
					label="Pairing Code"
					placeholder="ABCDEFG123"
					description="Start pairing from the other service, then enter the code it gives you."
					value={m.flow.code()}
					onChange={m.flow.setCode}
					error={m.flow.error()}
				/>
			</form>
		)),
		Confirm: slot((m) => <PairingConfirm flow={m.flow} />),
	},
});
