import "marqy/vanilla";
import { loginLogos } from "@colibri-social/assets";
import { type Component, For } from "solid-js";

export const ATmosphereAppMarquee: Component = () => {
	const logoClasses =
		"max-w-14 p-2 max-h-14 object-contain border border-border rounded-md shrink-0";

	return (
		<div class="w-full py-6 overflow-hidden">
			<marqy-loop speed="0.7">
				<div class="flex gap-6 pr-6">
					<For each={loginLogos}>
						{(logo) => (
							<img
								src={logo}
								alt={"An atmosphere app's logo."}
								class={logoClasses}
							/>
						)}
					</For>
				</div>
			</marqy-loop>
		</div>
	);
};
