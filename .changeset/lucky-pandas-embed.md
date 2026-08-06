---
"@colibri-social/client": minor
"@colibri-social/website": minor
---

Add embedded mode, so another site can host a single Colibri community

`@colibri-social/client/embed` exports `mountColibri(target, config)`, an imperative mount so it works from any framework. The host owns authentication and passes in a signed-in `@atproto/api` Agent, because an OAuth session's DPoP key cannot move between origins. Routing is in-memory, so the embed never touches the host's URL.

`@colibri-social/client/embed.css` is a second stylesheet that skips Tailwind's preflight and scopes every rule under `.colibri-embed`, so it does not restyle the host page. Colours come from `--colibri-embed-*` custom properties, or from a single `brand` colour expanded with a WCAG AA contrast floor. Corner rounding is adjustable the same way: `radius` moves the whole scale and each step from `radius-sm` to `radius-4xl` can be pinned on its own. Kobalte portals now mount inside the embed root so menus and dialogs are styled.

Reads, writes and realtime events are observable through an `onEvent` stream, instrumented at the agent's fetch handler, the AppView client and the socket, so offline replays and direct `com.atproto.repo.*` calls are covered too.

The community switcher, invites and community creation are not part of an embed, non-members get a join panel, and the community order is never written back from one. Dark only for now.

<!-- whatsnew
title: Embed a community anywhere
icon: browser-fill
body: Communities can now be embedded in other websites, styled to match the site they live on.
kind: feature
-->
