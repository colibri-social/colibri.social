/**
 * Push Service Worker for Colibri.
 *
 * Receives Web Push messages from the AppView and shows native notifications
 * even when the app/tab is fully closed. Registered from the client at runtime
 * (see packages/client/src/notifications/push-web.ts).
 *
 * Expected push payload (JSON):
 *   { "title": string, "body": string, "tag"?: string, "data"?: { "channelUri"?: string } }
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

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const channelUri = event.notification.data && event.notification.data.channelUri;
	const target = channelUri
		? `/app/c/${channelUri.replace("at://", "")}`
		: "/app";

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				for (const client of clientList) {
					if ("focus" in client) {
						client.focus();
						if ("navigate" in client) client.navigate(target);
						return;
					}
				}
				return self.clients.openWindow(target);
			}),
	);
});
