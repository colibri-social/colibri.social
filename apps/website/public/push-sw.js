/**
 * Push Service Worker for Colibri.
 *
 * Receives Web Push messages from the AppView and shows native notifications
 * even when the app/tab is fully closed. Registered from the client at runtime
 * (see packages/client/src/notifications/push-web.ts).
 *
 * Expected push payload (JSON):
 *   { "title": string, "body": string, "tag"?: string,
 *     "data"?: { "channelUri"?: string, "channel"?: string,
 *                "threadUri"?: string, "messageUri"?: string,
 *                "messageAuthor"?: string, "messageRkey"?: string } }
 *
 * Dismissal payload (sent when the underlying message was deleted; closes the
 * matching notification instead of showing one):
 *   { "type": "dismiss", "tag": string, "data"?: { "channelUri"?: string, "messageUri"?: string } }
 */

const DEFAULT_ICON = "/web-app-manifest-192x192.png";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = { title: "Colibri", body: event.data ? event.data.text() : "" };
	}

	if (payload.type === "dismiss") {
		if (!payload.tag) return;
		event.waitUntil(
			self.registration
				.getNotifications({ tag: payload.tag })
				.then((notifications) => {
					for (const notification of notifications) notification.close();
				}),
		);
		return;
	}

	const title = payload.title || "Colibri";
	event.waitUntil(
		self.registration.showNotification(title, {
			body: payload.body || "",
			tag: payload.tag,
			icon: payload.icon || DEFAULT_ICON,
			badge: DEFAULT_ICON,
			data: payload.data || {},
		}),
	);
});

// Fires when the browser invalidates/rotates our subscription on its own
// (independent of anything the AppView does) — e.g. periodic push-service key
// rotation. We must re-subscribe before this handler returns or the new
// subscription is lost, but we can't reach the AppView from here (no access
// to the app's authenticated XRPC client). Instead we just re-subscribe
// locally and nudge any open windows; the client re-registers the resulting
// subscription with the AppView using its own (already-authenticated)
// registerPush call — see `listenForPushSubscriptionChanges` in
// `packages/client/src/notifications/push-web.ts`.
self.addEventListener("pushsubscriptionchange", (event) => {
	const oldSubscription = event.oldSubscription;
	const applicationServerKey =
		oldSubscription && oldSubscription.options
			? oldSubscription.options.applicationServerKey
			: undefined;

	event.waitUntil(
		self.registration.pushManager
			.subscribe(
				applicationServerKey
					? { userVisibleOnly: true, applicationServerKey }
					: { userVisibleOnly: true },
			)
			.then(() =>
				self.clients.matchAll({ type: "window", includeUncontrolled: true }),
			)
			.then((clientList) => {
				for (const client of clientList) {
					client.postMessage({ type: "colibri-push-subscription-changed" });
				}
			})
			.catch((err) => {
				// Nothing more we can do from here — if no subscription survives,
				// the app's periodic re-assertion (see push-web.ts) will notice
				// there's none and re-subscribe from scratch next time it runs.
				console.error(
					"[push-sw] resubscribe after pushsubscriptionchange failed",
					err,
				);
			}),
	);
});

const MESSAGE_COLLECTION = "social.colibri.beta.message";

const parseSpace = (uri) => {
	if (typeof uri !== "string" || !uri.startsWith("at://")) return undefined;
	const [authority, marker, type, skey] = uri.slice("at://".length).split("/");
	if (marker !== "space" || !authority || !type || !skey) return undefined;
	return { authority, type, skey, uri: `at://${authority}/space/${type}/${skey}` };
};

const THREAD_SPACE_TYPE = "social.colibri.beta.channel.thread";

const isThreadType = (type) => type === THREAD_SPACE_TYPE;

const activationFrom = (data) => {
	if (!data) return undefined;

	const reported = data.channelUri || data.channel;
	if (typeof reported !== "string" || !reported) return undefined;

	let messageUri =
		typeof data.messageUri === "string" ? data.messageUri : undefined;

	const reportedSpace = parseSpace(reported);
	const messageSpace = parseSpace(messageUri);
	let threadUri = typeof data.threadUri === "string" ? data.threadUri : undefined;
	if (!threadUri && reportedSpace && isThreadType(reportedSpace.type)) {
		threadUri = reportedSpace.uri;
	}
	if (!threadUri && messageSpace && isThreadType(messageSpace.type)) {
		threadUri = messageSpace.uri;
	}

	if (!messageUri && data.messageAuthor && data.messageRkey) {
		messageUri = `${threadUri || reported}/${data.messageAuthor}/${MESSAGE_COLLECTION}/${data.messageRkey}`;
	}

	return { channelUri: reported, threadUri, messageUri };
};

const channelPathFor = (channelUri) => {
	const space = parseSpace(channelUri);
	if (!space || isThreadType(space.type)) return "/app";
	return `/app/c/${space.authority}/${space.type}/${encodeURIComponent(space.skey)}`;
};

const coldStartUrl = (activation) => {
	if (!activation) return "/app";

	const channel = channelPathFor(activation.channelUri);
	if (channel === "/app") return "/app";

	const thread = parseSpace(activation.threadUri);
	const path = thread
		? `${channel}/t/${encodeURIComponent(thread.skey)}`
		: channel;
	if (!activation.messageUri) return path;

	return `${path}?m=${encodeURIComponent(activation.messageUri)}`;
};

const isAppClient = (client) => {
	try {
		return new URL(client.url).pathname.startsWith("/app");
	} catch {
		return false;
	}
};

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const activation = activationFrom(event.notification.data);

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(async (clientList) => {
				const target = clientList.find(isAppClient);

				if (target) {
					if ("focus" in target) await target.focus();
					target.postMessage({
						type: "colibri-notification-activated",
						channelUri: activation ? activation.channelUri : undefined,
						threadUri: activation ? activation.threadUri : undefined,
						messageUri: activation ? activation.messageUri : undefined,
					});
					return;
				}

				await self.clients.openWindow(coldStartUrl(activation));
			}),
	);
});
