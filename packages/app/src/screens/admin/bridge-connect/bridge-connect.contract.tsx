import {
	IconButton,
	StatusScreen,
	Step,
	StepList,
	TextField,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import { createMemo, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { FEATURED_BRIDGES, PAIRING_GUIDES } from "../bridges/bridge-catalog";
import {
	createPairingFlow,
	PairingConfirm,
	useBridgeAdmin,
} from "../bridges/pairing";
import { AdminNavHeader } from "../desktop/page-header";

const UNKNOWN_BRIDGE = {
	title: "This bridge isn't available",
	description: "Go back and pick one of the featured bridges.",
} as const;

export const bridgeConnect = defineContract({
	id: "adminBridgeConnect",
	model: (args: AdminArgs) => {
		const bridge = useBridgeAdmin(args);
		const featured = createMemo(() =>
			FEATURED_BRIDGES.find((entry) => entry.id === args.id),
		);
		const guide = createMemo(() =>
			args.id ? PAIRING_GUIDES[args.id] : undefined,
		);
		return {
			...bridge,
			featured,
			guide,
			blocked: () =>
				bridge.unavailable() ??
				(featured() && guide() ? undefined : UNKNOWN_BRIDGE),
			flow: createPairingFlow(bridge, "bridge-connect"),
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to New Bridge"
				onNavigate={() => m.stack.pop()}
				title={
					m.featured() ? `Connect to ${m.featured()?.name}` : "Connect a bridge"
				}
			/>
		)),
		Unavailable: slot((m) => (
			<Show when={m.blocked()}>
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
		Steps: slot((m) => (
			<Show when={m.guide()}>
				{(guide) => (
					<StepList>
						<Step
							title={guide().invite.title}
							description={guide().invite.detail}
						>
							<a
								href={guide().invite.href}
								target="_blank"
								rel="noreferrer"
								class="focus-ring self-start rounded-xs text-sm text-primary-highlight underline-offset-2 hover:underline"
							>
								{guide().invite.label}
							</a>
						</Step>
						<Step
							title={guide().code.title}
							description={guide().code.detail}
						/>
						<Step title="Enter the pairing code" description={guide().enter}>
							<form
								class="flex items-start gap-2"
								onSubmit={(event) => {
									event.preventDefault();
									void m.flow.submit();
								}}
							>
								<TextField
									aria-label="Pairing code"
									placeholder="ABCDEFG123"
									class="min-w-0 flex-1"
									value={m.flow.code()}
									onChange={m.flow.setCode}
									error={m.flow.error()}
								/>
								<IconButton
									type="submit"
									variant="primary"
									size="lg"
									label="Connect"
									icon={<CheckIcon />}
									disabled={!m.flow.canSubmit()}
									loading={m.flow.busy()}
								/>
							</form>
						</Step>
					</StepList>
				)}
			</Show>
		)),
		Confirm: slot((m) => <PairingConfirm flow={m.flow} />),
	},
});
