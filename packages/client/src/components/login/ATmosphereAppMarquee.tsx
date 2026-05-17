import { Component } from "solid-js";

export const ATmosphereAppMarquee: Component = () => {
	const logos = import.meta.glob<{ default: string }>(
		"../../assets/login/*.svg",
		{ eager: true },
	);

	const logoClasses =
		"max-w-14 p-2 max-h-14 object-contain border border-border rounded-md";

	return (
		<div class="marquee-container w-full py-6 overflow-hidden flex">
			<div class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6">
				{Object.entries(logos).map((logo) => (
					<img
						src={logo[1].default}
						alt={"An atmosphere app's logo."}
						class={logoClasses}
					/>
				))}
			</div>
			<div
				class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6"
				aria-hidden="true"
			>
				{Object.entries(logos).map((logo) => (
					<img
						src={logo[1].default}
						alt={"An atmosphere app's logo."}
						class={logoClasses}
					/>
				))}
			</div>
		</div>
	);
};
