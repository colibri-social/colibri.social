---
"@colibri-social/app": minor
"@colibri-social/ui": minor
"@colibri-social/lib": minor
---

Connect to the closest Colibri node and stay connected while nodes restart.

- On start, the app lists the network's nodes, measures the round trip to each one and connects its event socket to the fastest. Images and files load from the fastest node too. The measurement is remembered for the next start and taken again on resume after 10 minutes. An AppView without nodes works as before.
- When a node announces it's going offline, the app opens a socket to the next closest node, waits until it's subscribed there, then closes the old one, so no event is missed. It also moves when another node is much faster.
- When no other node can take over, a notice says Colibri is restarting for an update and how many minutes are left.
- When the node can't save changes, a notice says changes are on hold. The outbox keeps them and sends them once writes work again. A `ReadOnly` error is retried later.
- Image attachments show their smaller `previewUrl` in messages. The lightbox and downloads keep the original.
- `ConnectionCard` has `restarting` and `readOnly` states and a `deadline` prop. `MediaItem` takes a `previewSrc` that tiles show in place of `src`.
- `@colibri-social/lib` adds the `ReadOnly` error code with its copy.
