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
import { communityUriToUrlCompatible } from "../../../atproto/community-uri-to-url-compatible";
import { joinCommunity } from "../../../atproto/memberships";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { useMutes } from "../../../contexts/Mutes";
import { useUserContext } from "../../../contexts/User";
import { AtURI } from "../../../utils/at-uri";
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

export const PENDING_INVITE_KEY = "colibri:pending-invite";

const clearPendingInvite = () => {
	try {
		localStorage.removeItem(PENDING_INVITE_KEY);
	} catch {}
};

export const InviteModal: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const user = useUserContext();
	const mutes = useMutes();

	const [invite] = createResource(
		() => params.code!,
		(code) => user.xrpc.social.colibri.community.getInvitation(code),
	);

	const [muteOn, setMuteOn] = createSignal(false);
	const [joining, setJoining] = createSignal(false);

	onMount(clearPendingInvite);

	const dismiss = () => {
		clearPendingInvite();
		navigate("/app", { replace: true });
	};

	createEffect(() => {
		const data = invite();
		if (!data) return;
		const segment = communityUriToUrlCompatible(data.community);
		const alreadyMember = user.communities.some(
			(c) => communityUriToUrlCompatible(c.uri) === segment,
		);
		if (alreadyMember) navigate(`/app/c/${segment}`, { replace: true });
	});

	const accept = async () => {
		const data = invite();
		if (!data) return;

		setJoining(true);
		try {
			await joinCommunity(user.atproto.agent, user.did, data.community);
			if (muteOn()) await mutes.muteCommunity(data.community);
			clearPendingInvite();

			if (data.requiresApprovalToJoin) {
				toast.success("Your request to join has been sent to the moderators.");
				navigate("/app", { replace: true });
				return;
			}

			navigate(`/app/c/${communityUriToUrlCompatible(data.community)}`, {
				replace: true,
			});
		} catch (err) {
			console.error(err);
			toast.error("Failed to join community.");
			setJoining(false);
		}
	};

	const avatarUrl = () => resolveBlob(user.did, user.data.avatar);
	const displayName = () => user.data.displayName || user.handle;

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
						<Match when={!invite() || invite()?.active === false}>
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
								const communityDid = () =>
									AtURI.parseAtURI(data().community).did;
								const pictureUrl = () =>
									resolveBlob(communityDid(), data().picture);

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
													alt={data().name}
													class="w-16 h-16 rounded-2xl object-cover bg-card"
												/>
											</Show>
											<small class="text-muted-foreground">
												You've been invited to join
											</small>
											<h2 class="text-2xl font-black m-0">{data().name}</h2>
											<div class="flex items-center gap-4 text-sm text-muted-foreground">
												<span class="flex items-center gap-1.5">
													<span class="w-2 h-2 rounded-full bg-green-500" />
													{data().onlineCount} Online
												</span>
												<span class="flex items-center gap-1.5">
													<span class="w-2 h-2 rounded-full bg-muted-foreground" />
													{data().memberCount} Members
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
											<Button onClick={accept} disabled={joining()}>
												<Show when={!joining()} fallback={<Spinner />}>
													<span>Accept as</span>
													<span class="flex flex-row gap-1.5 items-center">
														<img
															width="24"
															height="24"
															alt={displayName()}
															src={avatarUrl() ?? "/user-placeholder.png"}
															class="rounded-full"
														/>
														{displayName()}
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
