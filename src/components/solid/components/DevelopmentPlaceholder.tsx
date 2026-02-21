import type { Component } from "solid-js";

export const DevelopmentPlaceholder: Component = () => (
	<div class="bg-neutral-950 w-full h-full rounded-tl-xl border-t border-l border-neutral-800 flex items-center justify-center">
		<div class="flex flex-col items-center justify-center max-w-2xl text-center">
			<img
				src="/logo.png"
				width={128}
				height={128}
				alt="The Colibri Social logo, a purple hummingbird."
			/>
			<h3>You seem to be new here. Welcome!</h3>
			<p>
				Colibri is under active development. You're currently unable to create
				any communities, as we simply have not implemented that functionality
				yet. Please check back soon or contact{" "}
				<a href="https://bsky.app/profile/lou.gg">@lou.gg</a> on Bluesky for
				more info.
			</p>
		</div>
	</div>
);
