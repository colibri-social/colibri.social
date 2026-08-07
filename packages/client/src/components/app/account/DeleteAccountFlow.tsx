import {
	type Component,
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import {
	type DeleteProgress,
	deleteColibriAccount,
} from "../../../atproto/delete-account";
import {
	describePdsOperator,
	type PdsOperator,
} from "../../../atproto/pds-operator";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { endSession } from "../../../atproto/session";
import type { SoleOwnedCommunity } from "../../../atproto/xrpc/social/colibri/actor";
import { useUserContext } from "../../../contexts/User";
import { AtURI } from "../../../utils/at-uri";
import { openExternalLink } from "../../../utils/open-external-link";
import { Spinner } from "../../icons/Spinner";
import { Alert, AlertDescription, AlertTitle } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput } from "../../ui/TextField";

type Stage = "review" | "working" | "done";

const ExternalLink: Component<{ href: string; children: string }> = (props) => (
	<button
		type="button"
		class="underline cursor-pointer text-left"
		onClick={() => openExternalLink(props.href)}
	>
		{props.children}
	</button>
);

const initials = (name: string) =>
	name
		.split(" ")
		.map((word) => word.substring(0, 1))
		.join("")
		.substring(0, 3);

const CommunityPreview: Component<{ community: SoleOwnedCommunity }> = (
	props,
) => {
	const pictureUrl = () =>
		resolveBlob(
			AtURI.parseAtURI(props.community.uri).did,
			props.community.picture,
			"small",
		);

	return (
		<li class="flex flex-row items-center gap-3">
			<Show
				when={pictureUrl()}
				fallback={
					<div class="w-10 h-10 shrink-0 rounded-md bg-muted flex items-center justify-center text-foreground text-sm font-bold">
						{initials(props.community.name)}
					</div>
				}
			>
				<img
					src={pictureUrl()}
					width="40"
					height="40"
					alt={props.community.name}
					class="w-10 h-10 shrink-0 rounded-md object-cover bg-card"
				/>
			</Show>
			<div class="flex flex-col min-w-0">
				<span class="font-medium text-foreground truncate">
					{props.community.name}
				</span>
				<span class="text-sm text-muted-foreground">
					{props.community.memberCount}{" "}
					{props.community.memberCount === 1 ? "member" : "members"}
				</span>
			</div>
		</li>
	);
};

const OperatorNotice: Component<{ operator: PdsOperator | undefined }> = (
	props,
) => (
	<Alert>
		<AlertTitle>Your atproto account stays where it is</AlertTitle>
		<AlertDescription>
			<Show
				when={props.operator}
				fallback={<span>This only removes your Colibri data.</span>}
			>
				<span>
					This only removes your Colibri data. Your identity, handle, and
					everything outside Colibri live on {props.operator!.host}, which
					Colibri does not control.
				</span>
				<Show when={props.operator!.deletionUrl}>
					<span>
						To delete that account, go to{" "}
						<ExternalLink href={props.operator!.deletionUrl!}>
							{props.operator!.deletionLinkLabel ?? "your account settings"}
						</ExternalLink>
						.
					</span>
				</Show>
				<Show
					when={!props.operator!.deletionUrl && props.operator!.contactEmail}
				>
					<span>
						To delete that account, contact the people who run it at{" "}
						{props.operator!.contactEmail}.
					</span>
				</Show>
			</Show>
		</AlertDescription>
	</Alert>
);

export const DeleteAccountFlow: Component<{
	onLoadingChange?: (loading: boolean) => void;
}> = (props) => {
	const user = useUserContext();

	const [stage, setStage] = createSignal<Stage>("review");
	const [confirmation, setConfirmation] = createSignal("");
	const [progress, setProgress] = createSignal<DeleteProgress | undefined>();
	const [failed, setFailed] = createSignal<Array<string>>([]);
	const [failure, setFailure] = createSignal<string | undefined>();

	const [status] = createResource(async () => {
		const res = await user.xrpc.social.colibri.actor.getDeletionStatus();
		return res.ok ? res.data : undefined;
	});

	const [operator] = createResource(
		() =>
			status.loading || !user.atproto.pdsHost
				? undefined
				: { host: user.atproto.pdsHost, accountPage: status()?.pdsAccountPage },
		(source) => describePdsOperator(source.host, source.accountPage),
	);

	const blockers = () => status()?.soleOwnedCommunities ?? [];
	const isValid = () =>
		confirmation().trim() === user.handle.replace("at://", "");

	const runDeletion = async () => {
		setStage("working");
		setFailure(undefined);
		props.onLoadingChange?.(true);

		const result = await deleteColibriAccount({
			agent: user.atproto.agent,
			did: user.did,
			xrpc: user.xrpc,
			onProgress: setProgress,
		});

		setFailed(result.failedCollections.map((entry) => entry.collection));

		if (result.error) {
			props.onLoadingChange?.(false);
			setFailure(result.error.message);
			setStage("review");
			return;
		}

		await user.atproto.client?.revoke(user.did);

		props.onLoadingChange?.(false);
		setStage("done");
	};

	const signOut = () => endSession();

	return (
		<div class="flex flex-col gap-4">
			<Switch>
				<Match when={stage() === "review"}>
					<Show when={failure()}>
						<Alert variant="destructive">
							<AlertTitle>Deletion did not finish</AlertTitle>
							<AlertDescription>{failure()}</AlertDescription>
						</Alert>
					</Show>

					<Show when={status.loading}>
						<div class="flex flex-row items-center gap-2 text-sm">
							<Spinner />
							Checking what deletion would affect.
						</div>
					</Show>

					<Show when={blockers().length > 0}>
						<Alert variant="destructive">
							<AlertTitle>
								Hand over your communities before deleting
							</AlertTitle>
							<AlertDescription>
								<span>
									You are the only owner of the communities below. Transfer
									ownership to someone else, or delete each community, and then
									come back.
								</span>
								<ul class="m-0 mt-3 flex flex-col gap-3 list-none p-0">
									<For each={blockers()}>
										{(community) => <CommunityPreview community={community} />}
									</For>
								</ul>
							</AlertDescription>
						</Alert>
					</Show>

					<Show when={blockers().length === 0 && !status.loading}>
						<div class="flex flex-col gap-2 text-sm">
							<p class="m-0">
								Deleting removes your Colibri profile and status, every message
								and reaction you have sent, your community memberships, your
								notifications and read state, your push subscriptions, and any
								invitations you created.
							</p>
							<p class="m-0">
								<strong>This cannot be undone.</strong> To confirm, type your
								handle below.
							</p>
						</div>

						<OperatorNotice operator={operator()} />

						<div class="flex flex-row gap-2 items-baseline-last">
							<TextField
								value={confirmation()}
								onChange={setConfirmation}
								validationState={isValid() ? "valid" : "invalid"}
							>
								<TextFieldInput
									placeholder={user.handle.replace("at://", "")}
									type="text"
									autocapitalize="none"
									autocorrect="off"
									required
								/>
							</TextField>
							<Button
								variant="destructive"
								disabled={!isValid()}
								onClick={runDeletion}
							>
								Delete my Colibri data
							</Button>
						</div>
					</Show>
				</Match>

				<Match when={stage() === "working"}>
					<div class="flex flex-row items-center gap-2 text-sm">
						<Spinner />
						<Switch fallback={<span>Preparing.</span>}>
							<Match when={progress()?.step === "push"}>
								<span>Turning off push notifications.</span>
							</Match>
							<Match when={progress()?.step === "collection"}>
								<span>
									Deleting your records (
									{(progress() as { index: number }).index + 1} of{" "}
									{(progress() as { total: number }).total}).
								</span>
							</Match>
							<Match when={progress()?.step === "appview"}>
								<span>Clearing your data from Colibri's servers.</span>
							</Match>
						</Switch>
					</div>
				</Match>

				<Match when={stage() === "done"}>
					<Show
						when={failed().length === 0}
						fallback={
							<Alert variant="destructive">
								<AlertTitle>Some records could not be deleted</AlertTitle>
								<AlertDescription>
									<span>
										Everything on Colibri's servers is gone, but these
										collections are still in your repo. Signing in again and
										retrying usually clears them.
									</span>
									<ul class="m-0 mt-2 flex flex-col gap-1">
										<For each={failed()}>
											{(collection) => <li>{collection}</li>}
										</For>
									</ul>
								</AlertDescription>
							</Alert>
						}
					>
						<Alert>
							<AlertTitle>Your Colibri data is deleted</AlertTitle>
							<AlertDescription>
								Nothing of yours is left on Colibri.
							</AlertDescription>
						</Alert>
					</Show>

					<OperatorNotice operator={operator()} />

					<div>
						<Button onClick={signOut}>Sign out</Button>
					</div>
				</Match>
			</Switch>
		</div>
	);
};
