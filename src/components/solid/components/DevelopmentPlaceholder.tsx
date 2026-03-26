import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { Button } from "../shadcn-solid/Button";
import { NewCommunityModal } from "./NewCommunityModal";

/**
 * A development placeholder to be displayed if a user has no communities.
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

				<NewCommunityModal navigate={navigate}>
					<Button>Create a community</Button>
				</NewCommunityModal>
			</div>
		</div>
	);
};
