import { WebSocketKeepAlive } from "@atproto/ws-client";

const main = async () => {
	const socket = new WebSocketKeepAlive({
		getUrl: async () =>
			`wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=social.colibri.message`,
		heartbeatIntervalMs: 5000,
	});
};

main();
