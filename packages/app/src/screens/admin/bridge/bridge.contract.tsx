import {
	BridgeLinks,
	Button,
	ConfirmDialog,
	DestructiveRow,
	ListGroup,
	StatusScreen,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { createSignal, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import { platformName } from "../bridges/bridge-catalog";
import { DISCONNECT_COPY } from "../bridges/pairing";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";
import {
	createBridgeLinks,
	installedIntro,
	ROOMS_FAILED,
} from "./bridge-links";

export const bridge = defineContract({
	id: "adminBridge",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const links = createBridgeLinks(admin, () => args.id);
		const [confirmOpen, setConfirmOpen] = createSignal(false);

		let disconnected = false;
		const unsaved = createUnsavedForm({
			depth: () =>
				stack
					.mounted()
					.findIndex(
						(layer) =>
							layer.kind === "admin" &&
							layer.page === "bridge" &&
							layer.space === args.space &&
							layer.id === args.id,
					) + 1,
			dirty: () => !disconnected && links.edited(),
			saving: links.busy,
			save: links.saveLinks,
			reset: links.reset,
		});

		const disconnect = async () => {
			const id = args.id;

			if (!id) return;

			try {
				await links.data()?.disconnect(id);
				disconnected = true;
				setConfirmOpen(false);
				toast.success("Bridge disconnected");
				stack.pop();
			} catch {
				toast.error("Couldn't disconnect the bridge. Try again.");
			}
		};

		return {
			stack,
			admin,
			links,
			allowed: () => !admin.community() || admin.can(SPACE_PERMISSIONS.manage),
			missing: () =>
				admin.missing() ||
				(!!links.data() &&
					!(links.data()?.loading() ?? true) &&
					!links.registration()),
			registration: links.registration,
			installed: links.installed,
			busy: links.busy,
			run: links.run,
			unsaved,
			confirmOpen,
			setConfirmOpen,
			disconnect,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to Bridges"
				onNavigate={() => m.stack.pop()}
				title={m.registration()?.remoteSpaceName ?? "Bridge"}
			/>
		)),
		Unavailable: slot((m) => (
			<StatusScreen
				tone={m.admin.missing() ? "destructive" : "neutral"}
				icon={
					m.admin.missing() ? (
						<DangerTriangleIcon />
					) : (
						<TransferHorizontalIcon />
					)
				}
				title={
					m.admin.missing()
						? "This Space isn't available"
						: !m.allowed()
							? "You can't manage bridges here"
							: "This bridge isn't connected anymore"
				}
				description={
					m.admin.missing()
						? "It may have been deleted, or you're no longer a member."
						: !m.allowed()
							? "Ask someone with the Manage Space permission to change bridges."
							: "It may have been disconnected by someone else."
				}
				actions={
					<Button block variant="secondary" onClick={() => m.stack.pop()}>
						Back to Bridges
					</Button>
				}
			/>
		)),
		Summary: slot((m) => (
			<Show when={m.registration()}>
				{(registration) => (
					<div class="flex items-center gap-3">
						<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
							<TransferHorizontalIcon aria-hidden="true" />
						</span>
						<div class="flex min-w-0 flex-col">
							<span class="truncate font-semibold">
								{registration().remoteSpaceName}
							</span>
							<span class="truncate text-xs text-muted-foreground">
								{m.installed()
									? "Connected by address"
									: `${platformName(registration().platform)} bridge run by ${registration().bridgeHandle ?? registration().bridge}`}
							</span>
						</div>
					</div>
				)}
			</Show>
		)),
		Toggles: slot((m) => (
			<Show when={m.registration()}>
				{(registration) => (
					<ListGroup>
						<ToggleRow
							title="Relay messages"
							description="Pausing keeps the linked channels, so you can resume later."
							checked={registration().enabled}
							disabled={m.busy()}
							onChange={(enabled) => void m.run({ enabled })}
						/>
						<ToggleRow
							title="Mirror moderation"
							description={
								m.installed()
									? "Hiding a relayed message here also removes it on the other services, and messages their moderators remove are hidden here."
									: `Hiding a relayed message here also removes it on ${platformName(registration().platform)}, and messages its moderators remove are hidden here. The bridge needs permission to manage messages there.`
							}
							checked={registration().mirrorModeration ?? false}
							disabled={m.busy()}
							onChange={(mirrorModeration) => void m.run({ mirrorModeration })}
						/>
					</ListGroup>
				)}
			</Show>
		)),
		Links: slot((m) => (
			<BridgeLinks
				platform={usePlatform()()}
				channels={m.links.channels()}
				rooms={m.links.rooms()}
				awaitingRooms={m.links.awaitingRooms()}
				loading={m.links.loading()}
				error={m.links.failed() ? ROOMS_FAILED : undefined}
				disabled={m.busy()}
				intro={installedIntro(m.links)}
				onRoomChange={m.links.setRoom}
				onHistoryChange={m.links.setHistory}
			/>
		)),
		Bar: slot((m) => <UnsavedBar form={m.unsaved} />),
		Danger: slot((m) => (
			<>
				<ListGroup>
					<DestructiveRow
						label="Disconnect bridge"
						onClick={() => m.setConfirmOpen(true)}
					/>
				</ListGroup>
				<ConfirmDialog
					open={m.confirmOpen()}
					onOpenChange={m.setConfirmOpen}
					title={DISCONNECT_COPY.title}
					description={DISCONNECT_COPY.description}
					confirmLabel="Disconnect"
					tone="destructive"
					onConfirm={m.disconnect}
				/>
			</>
		)),
	},
});
