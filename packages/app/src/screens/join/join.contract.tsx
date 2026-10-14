import {
	Button,
	DeveloperModeCard,
	type DiscoverySpace,
	type DiscoveryViewerState,
	inviteState,
	JoinSpaceAction,
	memberSummary,
	NavHeader,
	Skeleton,
	SpaceProfileHeader,
	StatusScreen,
	toast,
} from "@colibri-social/ui";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { UnlinkIcon } from "@solar-icons/solid/bold/unlink";
import { createEffect, createResource, createSignal, on, Show } from "solid-js";
import { AccessError, type InvitationPreview } from "../../data/access";
import { spaceKey } from "../../data/ids";
import { useData } from "../../data/store";
import type { CommunityView } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { toInviteSummary } from "../admin/access-shared";

export type JoinArgs = { code: string };

export type JoinProblem = "invalid" | "expired" | "used-up" | "banned";

export const JOIN_COPY = {
	title: "Invite",
	invalid: {
		title: "This invite link isn't valid",
		description: "It may have been deleted, or the link is mistyped.",
	},
	expired: {
		title: "This invite link has expired",
		description: "Ask someone in the Space for a new link.",
	},
	"used-up": {
		title: "This invite link was used up",
		description:
			"It reached its use limit. Ask someone in the Space for a new link.",
	},
	banned: {
		title: "You can't join this Space",
		description: "You were banned from it.",
	},
	joined: (name: string) => `You joined ${name}`,
	requested: (name: string) => `Request to join ${name} sent`,
	failed: "You couldn't join this Space. Try again.",
	loadFailed: "The invite couldn't be loaded. Check your connection.",
} as const;

const viewerStateOf = (community: CommunityView): DiscoveryViewerState => {
	if (community.viewer.isMember) return "member";
	if (community.viewer.applicationPending) return "pending";
	return "none";
};

const problemOf = (preview: InvitationPreview): JoinProblem | undefined => {
	if (preview.community.viewer.isMember) return undefined;
	const state = inviteState(toInviteSummary(preview.invitation), new Date());
	return state === "active" ? undefined : state;
};

export const join = defineContract({
	id: "join",
	model: (args: JoinArgs) => {
		const data = useData();
		const stack = useStack();
		const [preview] = createResource(
			() => args.code,
			async (code) => {
				try {
					return await data.access.resolveInvitation(code);
				} catch (error) {
					if (!(error instanceof AccessError))
						toast.error(JOIN_COPY.loadFailed);
					return undefined;
				}
			},
		);
		const [viewer, setViewer] = createSignal<DiscoveryViewerState>("none");
		const [problem, setProblem] = createSignal<JoinProblem>();
		const [busy, setBusy] = createSignal(false);

		const openSpace = (community: CommunityView) => {
			stack.popTo(0);
			stack.setRoot({ tab: "spaces", space: spaceKey(community) });
		};

		createEffect(
			on([() => preview.state, preview], ([state, current]) => {
				if (state !== "ready") return;
				if (!current) {
					setProblem("invalid");
					return;
				}
				setViewer(viewerStateOf(current.community));
				setProblem(problemOf(current));
				if (current.community.viewer.isMember) openSpace(current.community);
			}),
		);

		const space = (): DiscoverySpace | undefined => {
			const current = preview();
			if (!current) return undefined;
			const community = current.community;
			return {
				id: community.did,
				name: community.name,
				handle: community.handle,
				iconSrc: community.picture,
				bannerSrc: community.banner,
				description: community.description,
				memberCount: community.memberCount ?? 0,
				joinMode: community.requiresApprovalToJoin ? "approval" : "open",
				viewer: viewer(),
			};
		};

		const accept = async () => {
			const current = preview();
			if (!current || busy()) return;
			const community = current.community;
			setBusy(true);
			try {
				const result = await data.access.join(community.did, args.code);
				if (result.status === "pending") {
					setViewer("pending");
					toast.success(JOIN_COPY.requested(community.name));
					return;
				}
				setViewer("member");
				toast.success(JOIN_COPY.joined(community.name));
				openSpace(community);
			} catch (error) {
				if (error instanceof AccessError) {
					if (error.code === "Banned") return void setProblem("banned");
					if (error.code === "InvitationNotFound")
						return void setProblem("invalid");
					if (error.code === "AlreadyMember") return openSpace(community);
				}
				toast.error(JOIN_COPY.failed);
			} finally {
				setBusy(false);
			}
		};

		return {
			data,
			stack,
			preview,
			state: () =>
				preview.loading ? "loading" : problem() ? "problem" : "preview",
			space,
			problem,
			busy,
			accept,
			developerMode: () => data.controls().developerMode,
			openSpace: () => {
				const current = preview();
				if (current) openSpace(current.community);
			},
			leave: () => (stack.pop() ? undefined : stack.setRoot({ tab: "spaces" })),
		};
	},
	slots: {
		Header: slot((m) => (
			<NavHeader
				safeTop
				kind="back"
				onNavigate={m.leave}
				title={JOIN_COPY.title}
			/>
		)),
		Loading: slot(() => (
			<div role="status" aria-label="Loading invite" class="flex flex-col">
				<Skeleton class="aspect-[2/1] w-full rounded-none" />
				<div class="flex flex-col gap-3 px-4 pt-4">
					<Skeleton class="h-6 w-48 rounded-full" />
					<Skeleton class="h-4 w-64 rounded-full" />
					<Skeleton class="h-9 w-full rounded-control-lg" />
				</div>
			</div>
		)),
		Problem: slot((m) => (
			<Show when={m.problem()}>
				{(problem) => (
					<StatusScreen
						tone={problem() === "banned" ? "destructive" : "neutral"}
						icon={
							problem() === "banned" ? <ForbiddenCircleIcon /> : <UnlinkIcon />
						}
						title={JOIN_COPY[problem()].title}
						description={JOIN_COPY[problem()].description}
						actions={
							<Button block variant="secondary" onClick={m.leave}>
								Back to Spaces
							</Button>
						}
					/>
				)}
			</Show>
		)),
		Preview: slot((m) => (
			<Show when={m.space()}>
				{(space) => (
					<SpaceProfileHeader
						name={space().name}
						iconSrc={space().iconSrc}
						bannerSrc={space().bannerSrc}
						memberCount={space().memberCount}
						memberLabel={memberSummary(space())}
						description={space().description}
						actions={
							<JoinSpaceAction
								space={space()}
								busy={m.busy()}
								layout="stacked"
								onJoin={() => void m.accept()}
								onRequestJoin={() => void m.accept()}
								onOpenSpace={m.openSpace}
							/>
						}
					>
						<Show when={m.developerMode()}>
							<DeveloperModeCard
								copyLabel="Copy DID"
								copyValue={space().id}
								pdslsHref={`https://pdsls.dev/at://${space().id}`}
							/>
						</Show>
					</SpaceProfileHeader>
				)}
			</Show>
		)),
	},
});
