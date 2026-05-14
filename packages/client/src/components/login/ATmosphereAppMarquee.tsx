import anisotaLogo from "../../assets/login/anisota-logo-dark.svg";
import blackskyLogo from "../../assets/login/blacksky.webp";
import euroskyLogo from "../../assets/login/eurosky.webp";
import leafletLogo from "../../assets/login/leaflet.png";
import npmxLogo from "../../assets/login/npmx.png";
import sifaLogo from "../../assets/login/sifa.id.svg";
import streamPlaceLogo from "../../assets/login/stream.place.png";
import tangledLogo from "../../assets/login/tangled.org.svg";
import colibriLogo from "../../assets/logo.png";
import { Component } from "solid-js";
import { cx } from "../../utils/cva";

export const ATmosphereAppMarquee: Component = () => {
	const logos = [
		{
			src: anisotaLogo,
			alt: "Anisota",
			class: "p-2 bg-black",
			href: "https://anisota.net",
		},
		{ src: blackskyLogo, alt: "Blacksky", href: "https://blackskyweb.xyz" },
		{ src: euroskyLogo, alt: "Eurosky", href: "https://eurosky.tech" },
		{ src: leafletLogo, alt: "Leaflet", href: "https://leaflet.pub" },
		{ src: npmxLogo, alt: "NPMX", href: "https://npmx.dev" },
		{
			src: streamPlaceLogo,
			alt: "Stream.place",
			class: "p-2 bg-[#0c0a09]",
			href: "https://stream.place",
		},
		{
			src: tangledLogo,
			alt: "Tangled.org",
			class: "p-2 bg-[#0c0a09]",
			href: "https://tangled.org",
		},
		{
			src: colibriLogo,
			alt: "Colibri Social",
			class: "p-2 bg-background",
			href: "https://colibri.social",
		},
		{
			src: sifaLogo,
			alt: "Sifa.id",
			class: "p-2 bg-[#090a0c]",
			href: "https://sifa.id",
		},
	];

	const imageWrapperBase =
		"w-16! h-16! rounded-md border flex items-center justify-center shrink-0 overflow-hidden";

	return (
		<div class="marquee-container w-full py-6 overflow-hidden flex">
			<div class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6">
				{logos.map((logo) => (
					<a
						href={logo.href}
						rel="nofollow noreferrer"
						class={cx(imageWrapperBase, logo.class)}
					>
						<img
							src={logo.src}
							alt={logo.alt}
							class="max-w-full max-h-full object-contain"
						/>
					</a>
				))}
			</div>
			<div
				class="flex shrink-0 animate-marquee gap-6 min-w-full pr-6"
				aria-hidden="true"
			>
				{logos.map((logo) => (
					<a
						href={logo.href}
						rel="nofollow noreferrer"
						class={cx(imageWrapperBase, logo.class)}
					>
						<img
							src={logo.src}
							alt={logo.alt}
							class="max-w-full max-h-full object-contain"
						/>
					</a>
				))}
			</div>
		</div>
	);
};
