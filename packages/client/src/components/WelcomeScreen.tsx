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
	const navigate = useNavigate();
	const { preferences, setPublicReminderDismissed } = useUserPreferences();

	return (
		<div class="bg-background w-full h-full flex flex-col max-md:pl-14 md:border-t md:border-l md:border-border overflow-auto">
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
						request features and vote on what we build next on our{" "}
						<a
							href="https://userinput.app/s/did:plc:mprdjqjluoswa7awzggaggj3/3msnhieoy7y2n"
							target="_blank"
							rel="noreferrer"
							onClick={(e) =>
								openExternalLink(
									"https://userinput.app/s/did:plc:mprdjqjluoswa7awzggaggj3/3msnhieoy7y2n",
									e,
								)
							}
						>
							feedback board
						</a>
						. If you want to get involved in the development, check out our{" "}
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
						<Button
							variant="secondary"
							onClick={() => navigate("/app/invite/XD00Gweq6wL10NNW")}
						>
							Join the Colibri Social Community
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};
