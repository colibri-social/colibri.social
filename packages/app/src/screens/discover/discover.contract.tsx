import {
	Button,
	DeveloperModeCard,
	Discovery,
	DiscoveryScreen,
	type DiscoverySpace,
	StatusScreen,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createMemo, createSignal, Show } from "solid-js";
import { spaceKey } from "../../data/ids";
import { useData } from "../../data/store";
import type { CommunityView, Did } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import type { Platform } from "../../screen/platform";
import { useStack } from "../../shell/stack";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";

export type DiscoverArgs = Record<string, string>;

export const toDiscoverySpace = (community: CommunityView): DiscoverySpace => {
	const space: DiscoverySpace = {
		id: community.did,
		name: community.name,
		handle: community.handle,
		memberCount: community.memberCount ?? 0,
		joinMode: community.requiresApprovalToJoin ? "approval" : "open",
		viewer: community.viewer.isMember
			? "member"
			: community.viewer.applicationPending
				? "pending"
				: "none",
	};
	if (community.picture) space.iconSrc = community.picture;
	if (community.banner) space.bannerSrc = community.banner;
	if (community.description) space.description = community.description;
	return space;
};

export const JOIN_ERRORS: Record<string, string> = {
	Banned: "You're banned from this Space.",
	AlreadyMember: "You're already a member of this Space.",
	CommunityNotFound: "This Space isn't available anymore.",
};

export const discover = defineContract({
	id: "discover",
	model: (_args: DiscoverArgs) => {
		const data = useData();
		const stack = useStack();
		const [busy, setBusy] = createSignal<readonly string[]>([]);
		const directory = data.directory.discoverable;
		const spaces = createMemo(() =>
			(directory.value() ?? []).map(toDiscoverySpace),
		);
		const nameOf = (id: string) =>
			directory.value()?.find((entry) => entry.did === id)?.name ?? "the Space";

		const join = async (id: string) => {
			if (busy().includes(id)) return;
			setBusy((current) => [...current, id]);
			try {
				const result = await data.directory.join(id as Did);
				if (result.status === "joined") {
					toast.success(`You joined ${nameOf(id)}`, {
						action: { label: "Open", onClick: () => void openSpace(id) },
					});
				}
			} catch (error) {
				const code = error instanceof Error ? error.message : "";
				toast.error(JOIN_ERRORS[code] ?? `Couldn't join ${nameOf(id)}`);
			} finally {
				setBusy((current) => current.filter((entry) => entry !== id));
			}
		};

		const openSpace = async (id: string) => {
			const community = data.spaceByKey(id);
			if (!community) return;
			await whenOverlaysClosed();
			stack.setRoot({ tab: "spaces", space: spaceKey(community) });
			stack.popTo(0);
		};

		return {
			spaces,
			loading: directory.loading,
			failed: directory.failed,
			retry: () => void directory.refresh(),
			busy,
			join,
			openSpace,
			back: () => stack.pop(),
			developerMode: () => data.controls().developerMode,
			previewExtra: (space: DiscoverySpace) =>
				data.controls().developerMode ? (
					<DeveloperModeCard
						copyLabel="Copy DID"
						copyValue={space.id}
						pdslsHref={`https://pdsls.dev/at://${space.id}`}
					/>
				) : undefined,
		};
	},
	slots: {
		Directory: slot((m, p: { platform?: Platform }) => (
			<Show
				when={!m.failed()}
				fallback={
					<StatusScreen
						tone="destructive"
						icon={<DangerTriangleIcon />}
						title="Couldn't load Spaces"
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
					when={p.platform !== "desktop"}
					fallback={
						<Discovery
							platform="desktop"
							spaces={m.spaces()}
							loading={m.loading()}
							busyIds={m.busy()}
							onJoin={(id) => void m.join(id)}
							onRequestJoin={(id) => void m.join(id)}
							onOpenSpace={(id) => void m.openSpace(id)}
							previewExtra={m.previewExtra}
						/>
					}
				>
					<DiscoveryScreen
						spaces={m.spaces()}
						loading={m.loading()}
						busyIds={m.busy()}
						onBack={m.back}
						onJoin={(id) => void m.join(id)}
						onRequestJoin={(id) => void m.join(id)}
						onOpenSpace={(id) => void m.openSpace(id)}
						previewExtra={m.previewExtra}
					/>
				</Show>
			</Show>
		)),
	},
});
