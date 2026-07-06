---
eyebrow: "Hatching a social platform."
title: "ABOUT COLIBRI"
description: "Learn more about what Colibri is, why we built it, and why you should use it."
---

## What is Colibri?

Colibri is a chat app, similar to Discord, built on the AT Protocol (also called ATproto). It was originally
built by [@lou.gg](https://bsky.app/profile/lou.gg) and [@otterlord.dev](https://bsky.app/profile/otterlord.dev)
as a side project to figure out whether real-time chat applications on ATproto were possible. The start was Discord
moving toward mandatory age verification, which pushed us to look for an open alternative we'd actually want to use.
What started as a side project has since grown into a passion project.

## How does Colibri work?

Because Colibri is built on ATproto, there's no such thing as "a Colibri account." You sign in with your existing
Atmosphere identity, and your messages, images, and identity stay in your own PDS (Personal Data Server). You own
them, and they travel with you across the network instead of being locked inside our servers. Communities work the
same way: each one is its own repository on the network, so a community's data isn't trapped in any single app either.

Tying it all together is our App View, the service that reads everything happening across the network and stitches it
into the fast, real-time experience you get at [colibri.social](https://colibri.social).

That's the short version. If you're curious about the technical side (how data flows through the network, how
communities store their records, or how you can run Colibri yourself), it's all covered in the [documentation](/docs).

## Why not go proprietary?

A few reasons. First, the modern internet is rapidly becoming more and more closed off. Initiatives like ATproto make
sure that the internet and its communities stay open, and provide you with the tools to own your images, data, and
identity, and we want to support this. Second, it saves on development time. Figuring out a real-time chat system is no
easy feat, and ATproto just so happened to be a decent fit for the prototype. And because the whole thing is open, you
aren't tied to us: anyone can [run their own Colibri AppView](/docs/self-hosting/getting-started) and host their own communities.

## I like what I'm reading. Can I help out?

Yes, please! All the pieces of software we've made, the [App View](https://github.com/colibri-social/appview) and
[Website & App](https://github.com/colibri-social/colibri.social), are open source. We encourage contributions from the
community, be it new features, small fixes or adjustments, or even large additions to the system. Have a look at the
[contributing guide](/docs/contributing/overview) to get started.
