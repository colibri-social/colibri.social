import { loginLogos } from "@colibri-social/assets";
import { type Component, For } from "solid-js";

export const ATmosphereAppMarquee: Component = () => {
	const logoClasses =
		"max-w-14 p-2 max-h-14 object-contain border border-border rounded-md";

	return (
		<div class="marquee-container w-full py-6 overflow-hidden flex">
			<div class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6">
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
			<div
				class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6"
				aria-hidden="true"
			>
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
		</div>
	);
};
