import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type DiscoveryViewerState,
	inviteState,
	SpaceInviteCard,
	type SpaceInviteCardSpace,
	type SpaceInviteCardState,
	toast,
} from "@colibri-social/ui";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { AccessError, type InvitationPreview } from "../../../data/access";
import { useData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { routeFromLink } from "../../../native/deep-links";
import { toInviteSummary } from "../../admin/access-shared";
import { JOIN_COPY } from "../../join/join.contract";

const log = createLogger("invite-embed");

type Loaded =
	| { kind: "ready"; preview: InvitationPreview }
	| { kind: "invalid" }
	| { kind: "failed" };

const invitations = new Map<string, Promise<Loaded>>();
const settled = new Map<string, Loaded>();

type Invite = { code: string; community?: string };

const keyOf = (invite: Invite) =>
	invite.community ? `${invite.community}/${invite.code}` : invite.code;

const forget = (invite: Invite) => {
	invitations.delete(keyOf(invite));
	settled.delete(keyOf(invite));
};

export const inviteOf = (uri: string): Invite | undefined => {
	const layers = routeFromLink(uri)?.layers ?? [];
	const [layer] = layers;
	if (layers.length !== 1 || layer?.kind !== "join") return undefined;
	return layer.community
		? { code: layer.code, community: layer.community }
		: { code: layer.code };
};

const loadInvitation = (
	resolve: (invite: Invite) => Promise<InvitationPreview>,
	invite: Invite,
) => {
	const key = keyOf(invite);
	const cached = invitations.get(key);
	if (cached) return cached;
	const request = resolve(invite).then(
		(preview): Loaded => {
			const loaded: Loaded = { kind: "ready", preview };
			if (invitations.get(key) === request) settled.set(key, loaded);
			return loaded;
		},
		(error): Loaded => {
			invitations.delete(key);
			if (error instanceof AccessError) return { kind: "invalid" };
			log.warn("loading an invite failed", {
				code: classifyThrown(error, { method: "getInvitation" }).code,
			});
			return { kind: "failed" };
		},
	);
	invitations.set(key, request);
	return request;
};

const problemOf = (preview: InvitationPreview) => {
	const state = inviteState(toInviteSummary(preview.invitation), new Date());
	return state === "active" ? undefined : state;
};

export const InviteEmbed = (props: {
	url: string;
	code: string;
	community?: string;
	onOpenSpace?: (community: CommunityView) => void;
}) => {
	const invite = (): Invite => ({
		code: props.code,
		community: props.community,
	});
	const data = useData();
	const [attempt, setAttempt] = createSignal(0);
	const [loaded, setLoaded] = createSignal<Loaded | undefined>(
		settled.get(keyOf(invite())),
	);
	createEffect(() => {
		const target = invite();
		attempt();
		const known = settled.get(keyOf(target));
		if (known) {
			setLoaded(known);
			return;
		}
		setLoaded(undefined);
		let current = true;
		onCleanup(() => {
			current = false;
		});
		void loadInvitation(
			(value) => data.access.resolveInvitation(value.code, value.community),
			target,
		).then((result) => {
			if (current) setLoaded(result);
		});
	});
	const [viewerOverride, setViewerOverride] =
		createSignal<DiscoveryViewerState>();
	const [banned, setBanned] = createSignal(false);
	const [busy, setBusy] = createSignal(false);

	const preview = () => {
		const current = loaded();
		return current?.kind === "ready" ? current.preview : undefined;
	};

	const isMember = (community: CommunityView) =>
		community.viewer.isMember ||
		(data.communities.value() ?? []).some(
			(entry) => entry.did === community.did,
		);

	const viewer = (): DiscoveryViewerState => {
		const current = preview();
		if (!current) return "none";
		if (isMember(current.community)) return "member";
		const override = viewerOverride();
		if (override) return override;
		return current.community.viewer.applicationPending ? "pending" : "none";
	};

	const state = (): SpaceInviteCardState => {
		const current = loaded();
		if (!current) return "loading";
		if (current.kind !== "ready") return current.kind;
		if (banned()) return "banned";
		if (viewer() === "member") return "ready";
		return problemOf(current.preview) ?? "ready";
	};

	const space = (): SpaceInviteCardSpace | undefined => {
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

	const open = () => {
		const current = preview();
		if (current) props.onOpenSpace?.(current.community);
	};

	const join = async () => {
		const current = preview();
		if (!current || busy()) return;
		const community = current.community;
		setBusy(true);
		try {
			const result = await data.access.join(community.did, props.code);
			forget(invite());
			if (result.status === "pending") {
				setViewerOverride("pending");
				toast.success(JOIN_COPY.requested(community.name));
				return;
			}
			setViewerOverride("member");
			toast.success(JOIN_COPY.joined(community.name));
			props.onOpenSpace?.(community);
		} catch (error) {
			if (error instanceof AccessError) {
				if (error.code === "Banned") return void setBanned(true);
				if (error.code === "AlreadyMember") {
					setViewerOverride("member");
					return void props.onOpenSpace?.(community);
				}
				if (error.code === "InvitationNotFound") {
					forget(invite());
					return void setAttempt((value) => value + 1);
				}
			}
			log.warn("joining from an invite failed", {
				code: classifyThrown(error, { method: "joinCommunity" }).code,
			});
			toast.error(JOIN_COPY.failed);
		} finally {
			setBusy(false);
		}
	};

	return (
		<SpaceInviteCard
			url={props.url}
			state={state()}
			space={space()}
			busy={busy()}
			onJoin={() => void join()}
			onRequestJoin={() => void join()}
			onOpenSpace={open}
			onRetry={() => setAttempt((value) => value + 1)}
		/>
	);
};
