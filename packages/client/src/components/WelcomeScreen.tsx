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

	return (
		<div class="bg-background w-full h-full flex flex-col max-md:pl-14 md:border-t md:border-l md:border-border overflow-auto">
			<div class="flex-1 w-full flex items-center justify-center">
				<div class="flex flex-col items-center justify-center max-w-2xl w-full px-4 text-center">
					<img
						src={ColibriLogo}
						width={128}
						height={128}
						alt="The Colibri Social logo, a purple hummingbird."
					/>
					<h3>Welcome to the Spaces Test.</h3>
					<p>
						<strong>
							Stuff will break. Go crazy. Have fun. DM{" "}
							<a
								href="https://bsky.app/profile/lou.gg"
								target="_blank"
								rel="noreferrer"
								onClick={(e) =>
									openExternalLink("https://bsky.app/profile/lou.gg", e)
								}
							>
								@lou.gg
							</a>{" "}
							on Bluesky when stuff breaks.
						</strong>
					</p>

					<div class="flex flex-row flex-wrap justify-center items-center gap-4">
						<CommunityCreationModal>
							<Button>Create a community</Button>
						</CommunityCreationModal>
						<Button
							variant="secondary"
							onClick={() => navigate("/app/invite/e2FqxhPJry")}
						>
							Join the Space Testing Community
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};
