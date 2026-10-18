const MESSAGE_COLLECTION = "social.colibri.beta.message";
const THREAD_SPACE_TYPE = "social.colibri.beta.channel.thread";
const MARK_READ_ACTION = "mark-read";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

const text = (value) =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const readPayload = (event) => {
	if (!event.data) return {};
	try {
		const payload = event.data.json();
		return payload && typeof payload === "object" ? payload : {};
	} catch {
		return { body: event.data.text() };
	}
};

const flatten = (payload) => {
	const nested =
		payload.data && typeof payload.data === "object" ? payload.data : {};
	const { data: _nested, ...top } = payload;
	return { ...top, ...nested };
};

const targetOf = (data) =>
	text(data.threadUri) || text(data.channelUri) || text(data.channel);

const tagOf = (data) => text(data.tag) || text(data.messageUri);

const rkeyOf = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

const windowClients = () =>
	self.clients.matchAll({ type: "window", includeUncontrolled: true });

const hasFocusedClient = async () => {
	const clientList = await windowClients();
	return clientList.some(
		(client) => client.visibilityState === "visible" && client.focused,
	);
};

const openNotifications = () => self.registration.getNotifications();

const closeWhere = async (matches) => {
	for (const notification of await openNotifications()) {
		if (matches(notification.data || {}, notification)) notification.close();
	}
};

const notificationOptions = (data, overrides) => ({
	body: [text(data.subtitle), text(data.body) || ""]
		.filter((line) => line !== undefined)
		.join("\n"),
	tag: tagOf(data),
	icon: text(data.authorAvatarUrl),
	data,
	actions:
		text(data.readUrl) && text(data.readToken)
			? [{ action: MARK_READ_ACTION, title: "Mark as read" }]
			: [],
	...overrides,
});

const titleOf = (data) =>
	text(data.authorName) || text(data.title) || "Colibri";

const showMessage = async (data) => {
	if (await hasFocusedClient()) return;
	await self.registration.showNotification(
		titleOf(data),
		notificationOptions(data),
	);
};

const closeRead = (data) => {
	const target = targetOf(data);
	if (!target) return Promise.resolve();
	const through = text(data.through);
	return closeWhere((shown) => {
		if (targetOf(shown) !== target) return false;
		const messageUri = text(shown.messageUri);
		if (!through || !messageUri) return true;
		return rkeyOf(messageUri) <= through;
	});
};

const matchesMessage = (shown, data) => {
	const tag = tagOf(data);
	const messageUri = text(data.messageUri);
	return (
		(tag !== undefined && tagOf(shown) === tag) ||
		(messageUri !== undefined && text(shown.messageUri) === messageUri)
	);
};

const closeDeleted = (data) =>
	closeWhere((shown) => matchesMessage(shown, data));

const replaceEdited = async (data) => {
	const body = text(data.body);
	if (body === undefined) return;
	const shown = (await openNotifications()).find((notification) =>
		matchesMessage(notification.data || {}, data),
	);
	if (!shown) return;
	const previous = shown.data || {};
	const next = { ...previous, body };
	await self.registration.showNotification(
		shown.title,
		notificationOptions(next, { tag: shown.tag || tagOf(next), silent: true }),
	);
};

self.addEventListener("push", (event) => {
	const data = flatten(readPayload(event));
	const type = text(data.type) || "message";

	if (type === "read") {
		event.waitUntil(closeRead(data));
		return;
	}
	if (type === "delete" || type === "dismiss") {
		event.waitUntil(closeDeleted(data));
		return;
	}
	if (type === "edit") {
		event.waitUntil(replaceEdited(data));
		return;
	}
	event.waitUntil(showMessage(data));
});

self.addEventListener("pushsubscriptionchange", (event) => {
	const applicationServerKey =
		event.oldSubscription?.options?.applicationServerKey;

	event.waitUntil(
		self.registration.pushManager
			.subscribe(
				applicationServerKey
					? { userVisibleOnly: true, applicationServerKey }
					: { userVisibleOnly: true },
			)
			.then(windowClients)
			.then((clientList) => {
				for (const client of clientList) {
					client.postMessage({ type: "colibri-push-subscription-changed" });
				}
			})
			.catch((error) => {
				console.error("[push-sw] resubscribe failed", error);
			}),
	);
});

const parseSpace = (uri) => {
	if (typeof uri !== "string" || !uri.startsWith("at://")) return undefined;
	const [authority, marker, type, skey] = uri.slice("at://".length).split("/");
	if (marker !== "space" || !authority || !type || !skey) return undefined;
	return {
		authority,
		type,
		skey,
		uri: `at://${authority}/space/${type}/${skey}`,
	};
};

const isThreadType = (type) => type === THREAD_SPACE_TYPE;

const activationFrom = (data) => {
	const reported = text(data.channelUri) || text(data.channel);
	if (!reported) return undefined;

	let messageUri = text(data.messageUri);
	const reportedSpace = parseSpace(reported);
	const messageSpace = parseSpace(messageUri);
	let threadUri = text(data.threadUri);
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
	return thread ? `${channel}/t/${encodeURIComponent(thread.skey)}` : channel;
};

const markRead = async (data) => {
	const readUrl = text(data.readUrl);
	const readToken = text(data.readToken);
	const target = targetOf(data);
	if (target) {
		await closeWhere((shown) => targetOf(shown) === target);
	}
	if (!readUrl || !readToken) return;
	try {
		await fetch(readUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: readToken }),
		});
	} catch (error) {
		console.error("[push-sw] mark as read failed", error);
	}
};

const pickClient = (clientList) =>
	clientList.find((client) => client.focused) ||
	clientList.find((client) => client.visibilityState === "visible") ||
	clientList[0];

const activate = async (data) => {
	const activation = activationFrom(data);
	const target = pickClient(await windowClients());

	if (target) {
		if ("focus" in target) await target.focus();
		target.postMessage({
			type: "colibri-notification-activated",
			channelUri: activation?.channelUri,
			threadUri: activation?.threadUri,
			messageUri: activation?.messageUri,
		});
		return;
	}

	await self.clients.openWindow(coldStartUrl(activation));
};

self.addEventListener("notificationclick", (event) => {
	const data = event.notification.data || {};
	event.notification.close();

	if (event.action === MARK_READ_ACTION) {
		event.waitUntil(markRead(data));
		return;
	}

	event.waitUntil(activate(data));
});
