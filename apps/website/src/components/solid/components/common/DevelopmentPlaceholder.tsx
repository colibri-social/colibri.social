import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { Alert, AlertDescription, AlertTitle } from "../../shadcn-solid/Alert";
import { Button } from "../../shadcn-solid/Button";
import { CommunityCreationModal } from "../Community/CommunityCreationModal";

/**
 * A development placeholder to be displayed if a user has no communities.
 * @todo This should probably be it's own page, right now it is rendered as a fallback component from App.tsx
 */
export const DevelopmentPlaceholder: Component = () => {
	const navigate = useNavigate();

	return (
		<div class="bg-neutral-950 w-full h-full rounded-tl-xl border-t border-l border-neutral-800 flex items-center justify-center">
			<div class="flex flex-col items-center justify-center max-w-2xl text-center">
				<img
					src="/logo.png"
					width={128}
					height={128}
					alt="The Colibri Social logo, a purple hummingbird."
				/>
				<h3>Welcome to Colibri!</h3>
				<p>
					Colibri is under active development <b>and in alpha</b>. You can check
					our{" "}
					<a href="https://colibri.leaflet.pub/3mhxzpvpvps2m">
						announcement post
					</a>{" "}
					for more information. If you want to get involved in the development,
					check out our{" "}
					<a
						href="https://github.com/colibri-social"
						target="_blank"
						rel="noreferrer"
					>
						GitHub
					</a>
					!
				</p>

				<Alert variant="destructive" class="mb-4">
					<AlertTitle class="font-bold">
						Reminder: Messages on Colibri are visible to everyone by default!
					</AlertTitle>
					<AlertDescription>
						Make sure to never share passwords or personal information you do
						not want to be publically accessible on Colibri.
					</AlertDescription>
				</Alert>

<<<<<<<< HEAD:apps/website/src/components/solid/components/DevelopmentPlaceholder.tsx
				{/*<div class="flex flex-row items-center gap-4">
					<NewCommunityModal navigate={navigate}>
========
				<div class="flex flex-row items-center gap-4">
					<CommunityCreationModal navigate={navigate}>
>>>>>>>> 566f13f (chore: Refactor):apps/website/src/components/solid/components/common/DevelopmentPlaceholder.tsx
						<Button>Create a community</Button>
					</CommunityCreationModal>
					<a href="https://colibri.social/invite/1b0e708bd85c414e">
						<Button variant="secondary">
							Join the Colibri Social Community
						</Button>
					</a>
				</div>*/}
			</div>
		</div>
	);
};
