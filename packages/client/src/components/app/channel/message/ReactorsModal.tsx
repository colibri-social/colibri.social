import type { ActorData } from "@colibri-social/lib";
import twemoji from "@twemoji/api";
import { type Component, For, Show } from "solid-js";
import type { Reaction } from "../../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useCommunityContext } from "../../../../contexts/Community";
import createMediaQuery from "../../../../utils/create-media-query";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../../ui/Dialog";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
} from "../../../ui/Drawer";
import User from "../../user";

const ReactorsList: Component<{ reactions: Array<Reaction> }> = (props) => {
	const community = useCommunityContext();

	// Reactors are normally community members, fall back to a minimal actor so
	// people who have since left still get a row.
	const resolveReactor = (did: string): ActorData =>
		community().members.find((m) => m.did === did) ?? {
			did,
			handle: did,
			data: { displayName: did, isBot: false, onlineState: "offline" },
		};

	return (
		<div class="flex flex-col gap-4">
			<For each={props.reactions}>
				{(reaction) => (
					<div class="flex flex-col gap-2">
						<div class="flex flex-row items-center gap-2 text-sm text-muted-foreground">
							<span class="h-4 w-4" innerHTML={twemoji.parse(reaction.emoji)} />
							<span>{reaction.count}</span>
						</div>
						<div class="flex flex-col gap-2 pl-1">
							<For each={reaction.reactorDIDs}>
								{(did) => <User.InlineProfile user={resolveReactor(did)} />}
							</For>
						</div>
					</div>
				)}
			</For>
		</div>
	);
};

/**
 * A modal (drawer on mobile) listing every reactor of a message grouped by
 * emoji
 */
export const ReactorsModal: Component<{
	reactions: Array<Reaction>;
	open: boolean;
	setOpen: (open: boolean) => void;
}> = (props) => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<Show
			when={isDesktop()}
			fallback={
				<Drawer
					breakPoints={[0.75]}
					open={props.open}
					onOpenChange={props.setOpen}
				>
					<DrawerPortal>
						<DrawerContent>
							<DrawerHeader>
								<DrawerLabel class="m-0">Reactions</DrawerLabel>
							</DrawerHeader>
							<div class="p-4 pt-0 max-h-[60vh] overflow-y-auto">
								<ReactorsList reactions={props.reactions} />
							</div>
						</DrawerContent>
					</DrawerPortal>
				</Drawer>
			}
		>
			<Dialog open={props.open} onOpenChange={props.setOpen}>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle class="m-0">Reactions</DialogTitle>
						</DialogHeader>
						<div class="max-h-[60vh] overflow-y-auto">
							<ReactorsList reactions={props.reactions} />
						</div>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</Show>
	);
};
