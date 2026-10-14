import type { LinkEmbed } from "../types";
import { asUri } from "./refs";

export const embeds = {
	atproto: {
		uri: asUri("https://atproto.com/guides/overview"),
		title: "Protocol overview",
		description:
			"The AT Protocol is an open, decentralized network for building social applications.",
		siteName: "AT Protocol",
		image: {
			url: asUri("https://picsum.photos/seed/atproto-card/1200/630"),
			width: 1200,
			height: 630,
		},
	},
	figma: {
		uri: asUri("https://www.figma.com/design/Wu9dGXB3xLxokb5ss2Gmx2/Colibri"),
		title: "Colibri design system",
		description: "Tokens, components and mobile frames for the redesign.",
		siteName: "Figma",
		image: {
			url: asUri("https://picsum.photos/seed/figma-card/640/360"),
			width: 640,
			height: 360,
		},
	},
	solid: {
		uri: asUri("https://docs.solidjs.com/concepts/signals"),
		title: "Signals",
		description:
			"Signals are the primary means of managing state in your Solid application.",
		siteName: "Solid Docs",
	},
	trail: {
		uri: asUri(
			"https://www.alltrails.com/trail/italy/veneto/tre-cime-di-lavaredo-loop",
		),
		title: "Tre Cime di Lavaredo loop",
		description: "10.1 km loop, 4 h, moderate. Best from June to October.",
		siteName: "AllTrails",
		image: {
			url: asUri("https://picsum.photos/seed/tre-cime/1200/800"),
			width: 1200,
			height: 800,
		},
	},
	museum: {
		uri: asUri("https://www.rijksmuseum.nl/en/collection/SK-C-5"),
		title: "The Night Watch, Rembrandt van Rijn, 1642",
		description: "Rembrandt's largest and most famous painting.",
		siteName: "Rijksmuseum",
		image: {
			url: asUri("https://picsum.photos/seed/night-watch/800/640"),
			width: 800,
			height: 640,
		},
	},
	video: {
		uri: asUri("https://www.youtube.com/watch?v=aqz-KE-bpKQ"),
		title: "Big Buck Bunny 60fps 4K",
		description: "Official Blender Foundation release.",
		siteName: "YouTube",
		image: {
			url: asUri("https://picsum.photos/seed/bunny-thumb/1280/720"),
			width: 1280,
			height: 720,
		},
	},
} satisfies Record<string, LinkEmbed>;
