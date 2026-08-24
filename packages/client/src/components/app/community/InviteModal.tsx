import { useNavigate, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	Match,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import { colibri } from "../../../atproto/lexicons";
import { clientForManagingApp } from "../../../atproto/xrpc";
import { useMutes } from "../../../contexts/Mutes";
import { useUserContext } from "../../../contexts/User";
import { classifyThrown } from "../../../errors/classify";
import { describeError } from "../../../errors/copy";
import { createLogger } from "../../../utils/logger";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import { Dialog, DialogContent, DialogPortal } from "../../ui/Dialog";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as ToggleSwitch,
} from "../../ui/Switch";
import { displayableNameFn } from "../user/DisplayableName";
import { PENDING_INVITE_KEY } from "./invite-storage";

const log = createLogger("invite");

const clearPendingInvite = () => {
	try {
		localStorage.removeItem(PENDING_INVITE_KEY);
	} catch {}
};

const ADMISSION_TIMEOUT_MS = 15_000;
const ADMISSION_POLL_MS = 1_000;

export const InviteModal: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const user = useUserContext();
	const mutes = useMutes();

	const [invite] = createResource(
		() => params.code!,
		async (code) => {
			const res = await user.xrpc.call(colibri.community.getInvitation.main, {
				params: { code },
			});
			if (!res.ok) throw res.error;
			return res.data;
		},
	);

	const [muteOn, setMuteOn] = createSignal(false);
	const [joining, setJoining] = createSignal(false);

	onMount(clearPendingInvite);

	const dismiss = () => {
		clearPendingInvite();
		navigate("/app", { replace: true });
	};

	const isMemberOf = (did: string) =>
		user.communities.some((c) => c.did === did);

	createEffect(() => {
		const data = invite();
		if (!data?.community) return;
		if (isMemberOf(data.community.did)) {
			navigate(`/app/c/${data.community.did}`, { replace: true });
		}
	});

	const waitForAdmission = async (did: string) => {
		const deadline = Date.now() + ADMISSION_TIMEOUT_MS;

		while (!isMemberOf(did) && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, ADMISSION_POLL_MS));
			await user.refetchCommunities();
		}

		return isMemberOf(did);
	};

	const accept = async () => {
		const data = invite();
		if (!data) return;

		setJoining(true);
		try {
			const client = clientForManagingApp(
				user.atproto.agent,
				data.community.managingApp,
			);
			const joinRes = await client.call(colibri.community.join.main, {
				body: {
					community: data.community.did,
					invitation: data.invitation.code,
				},
			});
			if (!joinRes.ok) throw joinRes.error;

			if (muteOn()) await mutes.muteCommunity(data.community.did);

			if (joinRes.data.status === "pending") {
				clearPendingInvite();
				toast.success("Your request to join has been sent to the moderators.");
				navigate("/app", { replace: true });
				return;
			}

			if (!(await waitForAdmission(data.community.did))) {
				toast.error(
					"You joined, but the community hasn't confirmed it yet. Try again in a moment.",
				);
				setJoining(false);
				return;
			}

			clearPendingInvite();
			navigate(`/app/c/${data.community.did}`, { replace: true });
		} catch (err) {
			log.error("joining the community failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Failed to join community.");
			setJoining(false);
		}
	};

	const avatarUrl = () => user.avatar;

	return (
		<Dialog open onOpenChange={(open) => !open && dismiss()}>
			<DialogPortal>
				<DialogContent class="w-100 max-w-full flex flex-col gap-6">
					<Switch>
						<Match when={invite.loading}>
							<div class="flex items-center justify-center py-12">
								<Spinner className="h-8 w-8" />
							</div>
						</Match>
						<Match when={invite.error !== undefined}>
							<div class="flex flex-col items-center text-center gap-4 py-4">
								<h2 class="text-xl font-bold m-0">
									{describeError(invite.error).title}
								</h2>
								<p class="text-muted-foreground m-0">
									{describeError(invite.error).description}
								</p>
								<Button variant="secondary" onClick={dismiss}>
									Back to Colibri
								</Button>
							</div>
						</Match>
						<Match
							when={
								!invite() ||
								invite()?.invitation.active === false ||
								!invite()?.community
							}
						>
							<div class="flex flex-col items-center text-center gap-4 py-4">
								<h2 class="text-xl font-bold m-0">Invite invalid</h2>
								<p class="text-muted-foreground m-0">
									This invite may be expired, revoked, or invalid.
								</p>
								<Button variant="secondary" onClick={dismiss}>
									Back to Colibri
								</Button>
							</div>
						</Match>
						<Match when={invite()}>
							{(data) => {
								const pictureUrl = () => data().community.picture;

								return (
									<>
										<div class="flex flex-col items-center text-center gap-3">
											<Show
												when={pictureUrl()}
												fallback={
													<div class="w-16 h-16 rounded-2xl bg-muted" />
												}
											>
												<img
													src={pictureUrl()}
													width="64"
													height="64"
													alt={data().community.name}
													class="w-16 h-16 rounded-2xl object-cover bg-card"
												/>
											</Show>
											<small class="text-muted-foreground">
												You've been invited to join
											</small>
											<h2 class="text-2xl font-black m-0">
												{data().community.name}
											</h2>
											<div class="flex items-center gap-4 text-sm text-muted-foreground">
												<span class="flex items-center gap-1.5">
													<span class="w-2 h-2 rounded-full bg-muted-foreground" />
													{data().community.memberCount ?? 0} Members
												</span>
											</div>
										</div>

										<ToggleSwitch
											checked={muteOn()}
											onChange={setMuteOn}
											class="flex flex-row items-center justify-between gap-3 rounded-xl bg-card border border-border p-4"
										>
											<div class="flex flex-col text-left gap-0.5">
												<SwitchLabel>Mute this community</SwitchLabel>
												<SwitchDescription>
													You won't receive any notifications from this
													community.
												</SwitchDescription>
											</div>
											<SwitchInput />
											<SwitchControl>
												<SwitchThumb />
											</SwitchControl>
										</ToggleSwitch>

										<div class="flex flex-col gap-2">
											<Button
												onClick={accept}
												disabled={joining()}
												class="min-w-0"
											>
												<Show when={!joining()} fallback={<Spinner />}>
													<span class="shrink-0">Accept as</span>
													<span class="flex flex-row gap-1.5 items-center min-w-0">
														<img
															width="24"
															height="24"
															alt={displayableNameFn(user)}
															src={avatarUrl() ?? "/user-placeholder.png"}
															class="rounded-full shrink-0"
														/>
														<span class="truncate">
															{displayableNameFn(user)}
														</span>
													</span>
												</Show>
											</Button>
											<Button variant="ghost" onClick={dismiss}>
												No Thanks
											</Button>
										</div>
									</>
								);
							}}
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
