import { ConfirmDialog, toast } from "@colibri-social/ui";
import { createMemo, createSignal } from "solid-js";
import type { BridgePairingView } from "../../../data/types";
import type { AdminArgs } from "../../../shell/registry";
import { type Navigator, useStack } from "../../../shell/stack";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";
import { platformName } from "./bridge-catalog";

export const DISCONNECT_COPY = {
	title: "Disconnect this bridge?",
	description:
		"The bridge stops relaying straight away. Messages it already relayed stay where they are. To reconnect, pair it again with a new code.",
} as const;

export const BRIDGES_UNAVAILABLE = {
	missing: {
		title: "This Space isn't available",
		description: "It may have been deleted, or you're no longer a member.",
	},
	denied: {
		title: "You can't manage bridges here",
		description:
			"Ask someone with the Manage Space permission to connect bridges.",
	},
} as const;

export const useBridgeAdmin = (args: AdminArgs) => {
	const stack = useStack();
	const admin = useAdminSpace(args.space);
	const data = createMemo(() => {
		const community = admin.community();
		return community ? admin.data.directory.bridges(community.did) : undefined;
	});
	return {
		args,
		stack,
		admin,
		data,
		allowed: () => !admin.community() || admin.can(SPACE_PERMISSIONS.manage),
		unavailable: () =>
			admin.missing()
				? BRIDGES_UNAVAILABLE.missing
				: admin.community() && !admin.can(SPACE_PERMISSIONS.manage)
					? BRIDGES_UNAVAILABLE.denied
					: undefined,
	};
};

export const showBridge = (
	stack: Navigator,
	space: string,
	registration: string,
) => {
	const layers = stack.mounted().slice(0, stack.depth());
	const index = layers.findIndex(
		(layer) =>
			layer.kind === "admin" &&
			layer.space === space &&
			layer.page === "bridges",
	);
	if (index !== -1 && index + 1 < layers.length) stack.popTo(index + 1);
	stack.push({ kind: "admin", space, page: "bridge", id: registration });
};

export const createPairingFlow = (
	bridge: ReturnType<typeof useBridgeAdmin>,
) => {
	const [code, setCode] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const [pairing, setPairing] = createSignal<BridgePairingView>();
	const [confirmOpen, setConfirmOpen] = createSignal(false);

	const trimmed = () => code().trim();

	const submit = async () => {
		const data = bridge.data();
		if (!trimmed() || busy() || !data) return;
		setBusy(true);
		setError(undefined);
		try {
			setPairing(await data.lookUp(trimmed()));
			setConfirmOpen(true);
		} catch {
			setError("That pairing code didn't work. Check it and try again.");
		} finally {
			setBusy(false);
		}
	};

	const connect = async () => {
		const data = bridge.data();
		if (!data) return;
		try {
			const registration = await data.connect(trimmed());
			toast.success("Bridge connected");
			setConfirmOpen(false);
			showBridge(bridge.stack, bridge.args.space, registration.id);
		} catch (failure) {
			toast.error("Couldn't connect the bridge.");
			throw failure;
		}
	};

	return {
		code,
		setCode: (next: string) => {
			setCode(next);
			setError(undefined);
		},
		busy,
		error,
		pairing,
		confirmOpen,
		setConfirmOpen,
		canSubmit: () => trimmed().length > 0 && !busy(),
		submit,
		connect,
	};
};

export type PairingFlow = ReturnType<typeof createPairingFlow>;

export const PairingConfirm = (props: { flow: PairingFlow }) => (
	<ConfirmDialog
		open={props.flow.confirmOpen()}
		onOpenChange={props.flow.setConfirmOpen}
		title={`Connect ${props.flow.pairing()?.remoteSpaceName ?? "this bridge"}?`}
		description={(() => {
			const found = props.flow.pairing();
			if (!found) return undefined;
			const platform = platformName(found.platform);
			return `${found.bridgeHandle ?? found.bridge} will relay messages and reactions between ${found.remoteSpaceName} on ${platform} and the channels you link. Every member can see which bridges are connected.`;
		})()}
		confirmLabel="Connect"
		onConfirm={() => props.flow.connect()}
	/>
);
