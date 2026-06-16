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
