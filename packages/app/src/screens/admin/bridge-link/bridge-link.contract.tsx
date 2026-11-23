import { BridgeLinkStep, StatusScreen } from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import {
	createBridgeLinks,
	installedIntro,
	ROOMS_FAILED,
} from "../bridge/bridge-links";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";

const UNAVAILABLE = {
	missing: {
		title: "This Space isn't available",
		description: "It may have been deleted, or you're no longer a member.",
	},
	denied: {
		title: "You can't manage bridges here",
		description:
			"Ask someone with the Manage Space permission to change bridges.",
	},
	gone: {
		title: "This bridge isn't connected anymore",
		description: "It may have been disconnected by someone else.",
	},
} as const;

export const bridgeLink = defineContract({
	id: "adminBridgeLink",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const links = createBridgeLinks(admin, () => args.id);

		let leaving = false;

		useUnsavedChanges({
			depth: () =>
				stack
					.mounted()
					.findIndex(
						(layer) =>
							layer.kind === "admin" &&
							layer.page === "bridge-link" &&
							layer.space === args.space &&
							layer.id === args.id,
					) + 1,
			dirty: () => !leaving && !links.busy() && links.edited(),
			description: () => "The channels you picked won't be linked.",
		});

		const showBridge = () => {
			const id = args.id;

			if (!id) return;

			leaving = true;
			stack.replaceTop({
				kind: "admin",
				space: args.space,
				page: "bridge",
				id,
			});
		};

		const save = async () => {
			if (await links.saveLinks()) showBridge();
		};

		const unavailable = () => {
			if (admin.missing()) return UNAVAILABLE.missing;
			if (admin.community() && !admin.can(SPACE_PERMISSIONS.manage)) {
				return UNAVAILABLE.denied;
			}

			const data = links.data();

			if (data && !data.loading() && !links.registration()) {
				return UNAVAILABLE.gone;
			}

			return undefined;
		};

		return {
			stack,
			links,
			unavailable,
			save,
			skip: showBridge,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to Bridges"
				onNavigate={() => m.stack.pop()}
				title={m.links.registration()?.remoteSpaceName ?? "Link channels"}
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
		Step: slot((m) => (
			<BridgeLinkStep
				platform={usePlatform()()}
				channels={m.links.channels()}
				rooms={m.links.rooms()}
				awaitingRooms={m.links.awaitingRooms()}
				loading={m.links.loading()}
				error={m.links.failed() ? ROOMS_FAILED : undefined}
				disabled={m.links.busy()}
				intro={installedIntro(m.links)}
				saving={m.links.busy()}
				saveDisabled={!m.links.edited()}
				onRoomChange={m.links.setRoom}
				onHistoryChange={m.links.setHistory}
				onSave={() => void m.save()}
				onSkip={m.skip}
			/>
		)),
	},
});
