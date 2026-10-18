import {
	Button,
	DEFAULT_INVITE_SETTINGS,
	Drawer,
	DrawerContent,
	InviteLinkPanel,
	inviteRequestFrom,
	Modal,
	ModalContent,
	Skeleton,
	toast,
} from "@colibri-social/ui";
import { createSignal, Match, Show, Switch } from "solid-js";
import { type InvitationView, inviteUrl } from "../../../data/access";
import { useData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { usePlatform } from "../../../screen/platform";

export const INVITE_DRAWER_COPY = {
	title: (name: string) => `Invite people to ${name}`,
	failed: "The invite link couldn't be created.",
	share: (name: string) => `Join ${name} on Colibri`,
} as const;

export const createInviteDrawer = () => {
	const data = useData();
	const [target, setTarget] = createSignal<CommunityView>();
	const [open, setOpen] = createSignal(false);
	const [invitation, setInvitation] = createSignal<InvitationView>();
	const [failed, setFailed] = createSignal(false);
	let generation = 0;

	const create = async () => {
		const community = target();
		if (!community) return;
		const current = ++generation;
		setFailed(false);
		try {
			const next = await data.access.createInvitation({
				community: community.did,
				...inviteRequestFrom(DEFAULT_INVITE_SETTINGS),
			});
			if (current === generation) setInvitation(next);
		} catch {
			if (current === generation) setFailed(true);
		}
	};

	const show = (community: CommunityView) => {
		generation++;
		setTarget(community);
		setInvitation(undefined);
		setOpen(true);
		void create();
	};

	const name = () => target()?.name ?? "this Space";

	const platform = usePlatform();

	const content = () => (
		<div data-invite-drawer="" class="flex flex-col gap-4">
			<Switch>
				<Match when={invitation()}>
					{(current) => (
						<InviteLinkPanel
							url={inviteUrl(current().code)}
							title={INVITE_DRAWER_COPY.share(name())}
							onCopy={() => toast.success("Invite link copied")}
						/>
					)}
				</Match>
				<Match when={failed()}>
					<div role="alert" class="flex flex-col gap-3">
						<p class="m-0 text-sm text-destructive">
							{INVITE_DRAWER_COPY.failed}
						</p>
						<Button variant="secondary" onClick={() => void create()}>
							Try again
						</Button>
					</div>
				</Match>
				<Match when={!invitation()}>
					<div
						role="status"
						aria-label="Creating invite link"
						class="flex flex-col gap-4"
					>
						<Skeleton class="h-10 w-full rounded-control-lg" />
						<Skeleton class="h-9 w-full rounded-control-sm" />
					</div>
				</Match>
			</Switch>
		</div>
	);

	const Overlay = () => (
		<Show
			when={platform() === "desktop"}
			fallback={
				<Drawer open={open()} onOpenChange={setOpen}>
					<DrawerContent
						aria-label={INVITE_DRAWER_COPY.title(name())}
						header={
							<h2 class="m-0 truncate text-center text-xl leading-tight font-bold text-foreground">
								{INVITE_DRAWER_COPY.title(name())}
							</h2>
						}
					>
						{content()}
					</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={open()} onOpenChange={setOpen}>
				<ModalContent
					title={INVITE_DRAWER_COPY.title(name())}
					class="md:w-[440px]"
				>
					{content()}
				</ModalContent>
			</Modal>
		</Show>
	);

	return { show, Overlay };
};
