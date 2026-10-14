import {
	BridgeCard,
	BridgeEmptyState,
	BridgeSummaryCard,
	type BridgeSummaryCardProps,
	Button,
	ConfirmDialog,
	DestructiveRow,
	Drawer,
	DrawerContent,
	ListGroup,
	NavRow,
	Skeleton,
	SkeletonGroup,
	StatusScreen,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { AddIcon } from "@solar-icons/solid/linear/add";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { SpaceRef } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import type { Platform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { afterClosed, MENU_SELECTOR } from "../desktop/after-closed";
import { AdminNavHeader } from "../desktop/page-header";
import {
	BRIDGE_DOCS_URL,
	BRIDGES_DESCRIPTION,
	platformName,
	toConnectedBridge,
} from "./bridge-catalog";
import { DISCONNECT_COPY, useBridgeAdmin } from "./pairing";

export const bridges = defineContract({
	id: "adminBridges",
	model: (args: AdminArgs) => {
		const bridge = useBridgeAdmin(args);
		const connected = createMemo(() =>
			(bridge.data()?.registrations() ?? []).map(toConnectedBridge),
		);
		const channelNames = createMemo(() => {
			const community = bridge.admin.community();
			const list = community
				? (bridge.admin.data.space(community).channels.value() ?? [])
				: [];
			return new Map(list.map((channel) => [channel.space, channel.name]));
		});
		const summaries = createMemo(() =>
			(bridge.data()?.registrations() ?? []).map((registration) => {
				const featured = toConnectedBridge(registration);
				const backfills = registration.backfills ?? [];
				const status: BridgeSummaryCardProps["status"] = backfills.some(
					(entry) => entry.state === "failed",
				)
					? { tone: "error", label: "History import failed" }
					: !registration.enabled
						? { tone: "warning", label: "Paused" }
						: backfills.some((entry) => entry.state === "running")
							? { tone: "active", label: "Importing history" }
							: { tone: "active", label: "Relaying" };
				return {
					id: registration.id,
					name: registration.remoteSpaceName,
					platform: platformName(registration.platform),
					handle: registration.bridgeHandle ?? registration.bridge,
					verified: featured.verified,
					channels: registration.links.map(
						(link) =>
							channelNames().get(link.channel as SpaceRef) ?? link.remoteName,
					),
					status,
					mirrorModeration: !!registration.mirrorModeration,
				};
			}),
		);
		const [menuFor, setMenuFor] = createSignal<string>();
		const [menuOpen, setMenuOpen] = createSignal(false);
		const [confirmOpen, setConfirmOpen] = createSignal(false);

		const openBridge = (registration: string) =>
			bridge.stack.push({
				kind: "admin",
				space: args.space,
				page: "bridge",
				id: registration,
			});

		const menuBridge = () => {
			const id = menuFor();
			return id ? bridge.data()?.find(id) : undefined;
		};

		const disconnect = async () => {
			const id = menuFor();
			if (!id) return;
			try {
				await bridge.data()?.disconnect(id);
				toast.success("Bridge disconnected");
			} catch (failure) {
				toast.error("Couldn't disconnect the bridge.");
				throw failure;
			}
		};

		return {
			...bridge,
			loading: () => bridge.data()?.loading() ?? true,
			failed: () => bridge.data()?.failed() ?? false,
			retry: () => void bridge.data()?.refresh(),
			connected,
			summaries,
			menuOpen,
			setMenuOpen,
			menuBridge,
			confirmDisconnect: (registration: string) => {
				setMenuFor(registration);
				setConfirmOpen(true);
			},
			showMenu: (registration: string) => {
				setMenuFor(registration);
				setMenuOpen(true);
			},
			openBridge,
			newBridge: () =>
				bridge.stack.push({
					kind: "admin",
					space: args.space,
					page: "bridge-new",
				}),
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
				navigateLabel="Back to Space settings"
				onNavigate={() => m.stack.pop()}
				title="Bridges"
				action={
					m.unavailable()
						? undefined
						: {
								type: "icon",
								label: "New bridge",
								icon: <AddIcon />,
								onClick: m.newBridge,
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
		Intro: slot(() => (
			<p class="m-0 text-sm text-muted-foreground">
				{`${BRIDGES_DESCRIPTION} `}
				<a
					href={BRIDGE_DOCS_URL}
					target="_blank"
					rel="noreferrer"
					class="focus-ring rounded-xs text-foreground underline-offset-2 hover:underline"
				>
					documentation
				</a>
				.
			</p>
		)),
		List: slot((m, p: { platform?: Platform }) => (
			<Show
				when={!m.failed()}
				fallback={
					<StatusScreen
						tone="destructive"
						icon={<DangerTriangleIcon />}
						title="Couldn't load bridges"
						description="Check your connection and try again."
						actions={
							<Button block variant="secondary" onClick={m.retry}>
								Try again
							</Button>
						}
					/>
				}
			>
				<Show
					when={!m.loading()}
					fallback={
						<SkeletonGroup
							label="Loading bridges"
							class={
								p.platform === "desktop"
									? "grid grid-cols-2 gap-4"
									: "flex flex-col gap-4"
							}
						>
							<Skeleton class="h-28 w-full rounded-control" />
							<Skeleton class="h-28 w-full rounded-control" />
						</SkeletonGroup>
					}
				>
					<Show
						when={m.connected().length > 0}
						fallback={
							<BridgeEmptyState title="No bridges yet">
								Connect a bridge to sync channels with another platform.
							</BridgeEmptyState>
						}
					>
						<Show
							when={p.platform === "desktop"}
							fallback={
								<ul
									aria-label="Connected bridges"
									data-bridge-list=""
									class={
										p.platform === "desktop"
											? "m-0 grid list-none grid-cols-2 gap-4 p-0"
											: "m-0 flex list-none flex-col gap-4 p-0"
									}
								>
									<For each={m.connected()}>
										{(entry) => (
											<li class="min-w-0">
												<BridgeCard
													name={entry.name}
													verified={entry.verified}
													service={entry.service}
													bridgedWith={entry.bridgedWith}
													menuLabel={`More actions for ${entry.name} bridge`}
													onMenu={() => m.showMenu(entry.id)}
												/>
											</li>
										)}
									</For>
								</ul>
							}
						>
							<ul
								aria-label="Connected bridges"
								data-bridge-list=""
								class="m-0 grid list-none grid-cols-2 gap-4 p-0"
							>
								<For each={m.summaries()}>
									{(entry) => (
										<li class="flex min-w-0">
											<BridgeSummaryCard
												{...entry}
												class="flex-1"
												menuItems={[
													{
														label: "Manage bridge",
														onSelect: () =>
															afterClosed(MENU_SELECTOR, () =>
																m.openBridge(entry.id),
															),
													},
													{
														label: "Disconnect bridge",
														tone: "destructive",
														onSelect: () => m.confirmDisconnect(entry.id),
													},
												]}
											/>
										</li>
									)}
								</For>
							</ul>
						</Show>
					</Show>
				</Show>
			</Show>
		)),
		Overlays: slot((m, p: { platform?: Platform }) => (
			<>
				<Show when={p.platform !== "desktop"}>
					<Drawer open={m.menuOpen()} onOpenChange={m.setMenuOpen}>
						<Show when={m.menuBridge()}>
							{(bridge) => (
								<DrawerContent
									title={bridge().remoteSpaceName}
									description={`${platformName(bridge().platform)} bridge run by ${bridge().bridgeHandle ?? bridge().bridge}`}
								>
									<div class="flex flex-col gap-4 pb-safe-offset-4">
										<ListGroup>
											<NavRow
												label="Manage bridge"
												onClick={() => {
													m.setMenuOpen(false);
													m.openBridge(bridge().id);
												}}
											/>
										</ListGroup>
										<ListGroup>
											<DestructiveRow
												label="Disconnect bridge"
												onClick={() => {
													m.setMenuOpen(false);
													m.setConfirmOpen(true);
												}}
											/>
										</ListGroup>
									</div>
								</DrawerContent>
							)}
						</Show>
					</Drawer>
				</Show>
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
