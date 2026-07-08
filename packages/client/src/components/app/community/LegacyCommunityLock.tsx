import type { Community } from "@colibri-social/lib";
import { type Component, createResource, Match, Show, Switch } from "solid-js";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { useUserContext } from "../../../contexts/User";
import { AtURI } from "../../../utils/at-uri";
import { Button } from "../../ui/Button";
import { CommunityCreationModal } from "../CommunityCreationModal";

/**
 * Shown instead of the community view when a community is still on the legacy
 * (pre-rework) schema
 */
export const LegacyCommunityLock: Component<{ community: Community }> = (
	props,
) => {
	const user = useUserContext();
	const isOwner = () => props.community.isOwner === true;

	// Best-effort owner handle for the non-owner message. Falls back to the DID.
	const [ownerHandle] = createResource(
		() => (isOwner() ? undefined : props.community.uri),
		async (uri) => {
			const did = uri.split("/")[2];
			const res = await user.xrpc.com.atproto.identity.resolveDid(did);
			const aka = (res?.data?.alsoKnownAs ?? res?.alsoKnownAs)?.[0];
			console.log(res);
			return typeof aka === "string" ? aka.replace("at://", "") : did;
		},
	);

	return (
		<div class="w-full h-full flex flex-col items-center justify-center gap-4 p-4 pl-20 sm:p-8! text-center select-none">
			<div class="w-14 h-14 overflow-hidden rounded-md bg-muted flex items-center justify-center text-muted-foreground">
				<Switch>
					<Match when={props.community.picture}>
						<img
							class="w-14 h-14 object-cover"
							src={resolveBlob(
								new AtURI(props.community.uri).did,
								props.community.picture,
							)}
							alt={props.community.name}
						/>
					</Match>
					<Match when={!props.community.picture}>
						<span class="font-bold text-3xl">
							{props.community.name
								.split(" ")
								.map((x) => x.substring(0, 1))
								.join("")
								.substring(0, 3)}
						</span>
					</Match>
				</Switch>
			</div>
			<h2 class="text-xl font-semibold m-0">{props.community.name}</h2>
			<Show
				when={isOwner()}
				fallback={
					<>
						<p class="text-muted-foreground max-w-md text-pretty my-0">
							This community hasn't been migrated to the new format yet. Ask the
							owner
							<Show when={ownerHandle()}>
								{" "}
								(<span class="font-medium">@{ownerHandle()}</span>)
							</Show>{" "}
							to migrate it so you can keep chatting here.
						</p>
						<a
							href="/docs/help/legacy-communities"
							target="_blank"
							rel="noopener"
							class="hover:underline text-primary"
						>
							Read more about legacy communities
						</a>
					</>
				}
			>
				<p class="text-muted-foreground max-w-md text-pretty my-0">
					This community is still on the old format and can't be opened. Migrate
					it to a new community to unlock it. Your channels, messages, and
					members come along automatically.{" "}
					<b>You will need to re-create server invitations.</b>
				</p>
				<a
					href="/docs/help/legacy-communities"
					target="_blank"
					rel="noopener"
					class="hover:underline text-primary"
				>
					Read more about legacy communities
				</a>
				<CommunityCreationModal
					migrateFrom={{
						uri: props.community.uri,
						name: props.community.name,
						description: props.community.description,
						picture: props.community.picture,
					}}
				>
					<Button>Migrate community</Button>
				</CommunityCreationModal>
			</Show>
		</div>
	);
};
