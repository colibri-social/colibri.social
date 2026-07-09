// Serves the pre-gzipped DeepFilterNet model (.tar.gz under /noise/) verbatim,
// stripping the Content-Encoding
export function verbatimNoiseAssets() {
	return {
		name: "verbatim-noise-assets",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (req.url?.startsWith("/noise/")) {
					const setHeader = res.setHeader.bind(res);
					res.setHeader = (name, ...rest) => {
						if (String(name).toLowerCase() === "content-encoding") return res;
						return setHeader(name, ...rest);
					};
				}
				next();
			});
		},
	};
}
