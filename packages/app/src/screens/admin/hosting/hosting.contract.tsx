import {
	type HostingState,
	HostingStatus,
	Skeleton,
	StatusScreen,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createMemo, Show } from "solid-js";
import { communityHostingFor } from "../../../data/community-hosting";
import type { HostingView } from "../../../data/hosting";
import { defineContract, slot } from "../../../screen/define";
import { HOST_MOVE_ENABLED } from "../../../shell/features";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import { useAdminSpace } from "../space-admin";
import { createHostSignIn } from "./host-sign-in";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const formatDate = (value: string | undefined) =>
	value ? dateFormat.format(new Date(value)) : undefined;

const serverName = (server: string) => {
	try {
		return new URL(server).host;
	} catch {
		return server;
	}
};

export const hostingStateOf = (view: HostingView): HostingState =>
	view.needsSignIn
		? "needsSignIn"
		: view.kind === "colibri"
			? "colibri"
			: "connected";

export const spaceHosting = defineContract({
	id: "adminHosting",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community } = admin;
		const hosting = communityHostingFor(data.source);
		const allowed = () => !!community()?.viewer.isOwner;
		const view = createMemo(() => {
			const current = community();
			return current && allowed() ? hosting.get(current.did)() : undefined;
		});
		const host = createHostSignIn(data);
		const signIn = async () => {
			const current = community();
			const hosted = view();
			if (current && hosted) await host.signIn(current, hosted.account);
		};

		return {
			...admin,
			back: () => stack.pop(),
			allowed,
			view,
			busy: host.busy,
			signIn,
			canMove: () => HOST_MOVE_ENABLED && view()?.kind === "colibri",
			move: () =>
				stack.push({ kind: "admin", space: args.space, page: "hosting-move" }),
			connectedBy: () => {
				const by = view()?.connectedBy;
				return by && by === data.viewer.did ? data.viewer.handle : undefined;
			},
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader safeTop kind="back" onNavigate={m.back} title="Hosting" />
		)),
		Missing: slot((m) => (
			<Show
				when={m.missing()}
				fallback={
					<StatusScreen
						tone="neutral"
						icon={<DangerTriangleIcon />}
						title="Only the owner can see this"
						description="Hosting is managed by the owner of the Space."
					/>
				}
			>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Intro: slot(() => (
			<p class="m-0 text-sm text-muted-foreground leading-prose">
				Every Space has its own account. This is where it lives.
			</p>
		)),
		Status: slot((m) => (
			<Show
				when={m.view()}
				fallback={
					<Skeleton
						data-hosting-skeleton=""
						class="h-48 w-full rounded-surface"
					/>
				}
			>
				{(view) => (
					<HostingStatus
						state={hostingStateOf(view())}
						spaceName={m.community()?.name ?? "This Space"}
						account={view().account}
						server={serverName(view().server)}
						connectedBy={m.connectedBy()}
						connectedSince={formatDate(view().connectedAt)}
						expiredOn={formatDate(view().needsSignInSince)}
						busy={m.busy()}
						onSignIn={() => void m.signIn()}
						onMove={m.canMove() ? m.move : undefined}
					/>
				)}
			</Show>
		)),
	},
});
