import type { AstroIntegration } from "astro";

export const serverPortIntegration = (): AstroIntegration => {
	let serverPort: number | undefined;

	return {
		name: "server-port-virtual-module",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: "server-port-virtual-module",
								resolveId(id) {
									if (id === "virtual:server-port") {
										return "\0virtual:server-port";
									}
									return null;
								},
								load(id) {
									if (id === "\0virtual:server-port") {
										const port =
											typeof serverPort === "number" ? serverPort : 4321;
										return `export const serverPort = ${port};`;
									}
									return null;
								},
							},
						],
					},
				});
			},
			"astro:server:start": ({ address }) => {
				serverPort = address.port;
			},
		},
	};
};
