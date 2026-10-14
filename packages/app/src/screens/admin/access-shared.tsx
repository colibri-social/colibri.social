import {
	Button,
	type InviteSummary,
	type MemberIdentityData,
	Skeleton,
	StatusScreen,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { For, type JSX, Show } from "solid-js";
import { type InvitationView, inviteUrl } from "../../data/access";
import { displayNameOf } from "../../data/adapters/authors";
import type { ProfileView } from "../../data/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const timeAgo = (value: string, now: Date = new Date()) => {
	const elapsed = Date.parse(value) - now.getTime();
	if (Number.isNaN(elapsed)) return "";
	const size = Math.abs(elapsed);
	if (size < MINUTE) return "just now";
	if (size < HOUR)
		return relative.format(Math.round(elapsed / MINUTE), "minute");
	if (size < DAY) return relative.format(Math.round(elapsed / HOUR), "hour");
	return relative.format(Math.round(elapsed / DAY), "day");
};

export const identityOf = (actor: ProfileView): MemberIdentityData => ({
	id: actor.did,
	name: displayNameOf(actor),
	handle: actor.handle,
	avatarSrc: actor.avatar,
});

export const toInviteSummary = (
	invitation: InvitationView,
	creator: InviteSummary["creator"] = { handle: "" },
): InviteSummary => ({
	code: invitation.code,
	url: inviteUrl(invitation.code),
	creator,
	uses: invitation.uses ?? 0,
	maxUses: invitation.maxUses,
	expiresAt: invitation.expiresAt,
});

export const SpaceMissing = () => (
	<StatusScreen
		tone="destructive"
		icon={<DangerTriangleIcon />}
		title="This Space isn't available"
		description="It may have been deleted, or you're no longer a member."
	/>
);

export const LoadFailed = (props: { title: string; onRetry: () => void }) => (
	<StatusScreen
		tone="destructive"
		icon={<DangerTriangleIcon />}
		title={props.title}
		description="Check your connection and try again."
		actions={
			<Button block variant="secondary" onClick={() => props.onRetry()}>
				Try again
			</Button>
		}
	/>
);

export const RowsSkeleton = (props: { rows?: number; label: string }) => (
	<div
		role="status"
		aria-label={props.label}
		class="flex flex-col overflow-hidden rounded-control bg-secondary"
	>
		<For each={Array.from({ length: props.rows ?? 3 })}>
			{() => (
				<div class="flex h-14 items-center gap-3 px-3">
					<Skeleton class="size-10 shrink-0 rounded-full" />
					<div class="flex flex-1 flex-col gap-1.5">
						<Skeleton class="h-3.5 w-32 rounded-full" />
						<Skeleton class="h-3 w-48 rounded-full" />
					</div>
				</div>
			)}
		</For>
	</div>
);

export const AdminPageBody = (props: {
	missing: boolean;
	missingView: JSX.Element;
	children: JSX.Element;
}) => (
	<div
		data-scroll-y=""
		class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
	>
		<Show
			when={!props.missing}
			fallback={<div class="flex min-h-full flex-col">{props.missingView}</div>}
		>
			<div class="flex min-h-full flex-col gap-6 p-4 pb-safe-offset-6">
				{props.children}
			</div>
		</Show>
	</div>
);
