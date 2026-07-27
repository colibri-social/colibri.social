import { logoUrl as ColibriLogo } from "@colibri-social/assets";
import { useNavigate } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import XIcon from "~icons/ph/x";
import { useUserPreferences } from "../contexts/UserPreferences";
import { openExternalLink } from "../utils/open-external-link";
import { CommunityCreationModal } from "./app/CommunityCreationModal";
import { Button } from "./ui/Button";

/**
 * A welcome screen to be displayed if a user has no communities.
 */
export const WelcomeScreen: Component = () => {
	const _navigate = useNavigate();
	const { preferences, setPublicReminderDismissed } = useUserPreferences();

	return (
		<div class="bg-neutral-950 w-full h-full flex flex-col max-md:pl-14 md:rounded-tl-xl md:border-t md:border-l md:border-neutral-800 overflow-auto">
			<Show when={!preferences().publicReminderDismissed}>
				<div class="w-full flex flex-row items-center gap-3 bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-3">
					<div class="flex flex-col gap-0.5 flex-1 text-sm">
						<span class="font-bold">
							Reminder: Messages on Colibri are visible to everyone by default!
						</span>
						<span class="text-destructive/90">
							Make sure to never share passwords or personal information you do
							not want to be publically accessible on Colibri.
						</span>
					</div>
					<button
						type="button"
						aria-label="Dismiss reminder"
						class="shrink-0 rounded-md p-1 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
						onClick={() => setPublicReminderDismissed(true)}
					>
						<XIcon />
					</button>
				</div>
			</Show>
			<div class="flex-1 w-full flex items-center justify-center">
				<div class="flex flex-col items-center justify-center max-w-2xl w-full px-4 text-center">
					<img
						src={ColibriLogo}
						width={128}
						height={128}
						alt="The Colibri Social logo, a purple hummingbird."
					/>
					<h3>Welcome to Colibri!</h3>
					<p>
						Colibri is under active development <b>and in beta</b>. You can
						check our{" "}
						<a
							href="https://colibri.leaflet.pub/3mhxzpvpvps2m"
							target="_blank"
							rel="noreferrer"
							onClick={(e) =>
								openExternalLink("https://colibri.leaflet.pub/3mhxzpvpvps2m", e)
							}
						>
							announcement post
						</a>{" "}
						for more information. If you want to get involved in the
						development, check out our{" "}
						<a
							href="https://github.com/colibri-social"
							target="_blank"
							rel="noreferrer"
							onClick={(e) =>
								openExternalLink("https://github.com/colibri-social", e)
							}
						>
							GitHub
						</a>
						!
					</p>

					<div class="flex flex-row flex-wrap justify-center items-center gap-4">
						<CommunityCreationModal>
							<Button>Create a community</Button>
						</CommunityCreationModal>
						{/* TODO(release): Re-enable once new invite link has been created
							<a href="https://colibri.social/invite/1b0e708bd85c414e">
							<Button variant="secondary">
								Join the Colibri Social Community
							</Button>
						</a>*/}
					</div>
				</div>
			</div>
		</div>
	);
};
