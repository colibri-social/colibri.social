---
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
Atmosphere identity, which stays with the provider you chose.

Conversations happen in Spaces. A Space is private: only its members can read its messages. Your messages are stored
in your own account wherever your provider supports private data, and you can take that account to another provider.
Where a provider doesn't support private data yet, Colibri stores your Space messages for you and moves them to your
account once it does.

Tying it all together is our AppView, the server that keeps a copy of each Space it serves, delivers messages live,
sends notifications, and carries voice and video calls at [colibri.social](https://colibri.social).

Private data is an unfinished part of the AT Protocol, so Colibri is a beta. The [Terms of Service](/tos) and the
[Privacy Policy](/policy) describe what that means for your data.

If you're curious about the technical side (how a Space is built, how the AppView keeps it in sync, or how you can
run Colibri yourself), it's all covered in the [documentation](/docs).

## Why not go proprietary?

A few reasons. First, the modern internet is rapidly becoming more and more closed off. Initiatives like ATproto make
sure that the internet and its communities stay open, and provide you with the tools to own your images, data, and
identity, and we want to support this. Second, it saves on development time. Figuring out a real-time chat system is no
easy feat, and ATproto just so happened to be a decent fit for the prototype. And because the whole thing is open, you
aren't tied to us: anyone can [run their own Colibri AppView](/docs/developers/self-hosting/getting-started) and host their own Spaces.

## I like what I'm reading. Can I help out?

Yes, please! All the pieces of software we've made, the [AppView](https://github.com/colibri-social/appview) and
[Website & App](https://github.com/colibri-social/colibri.social), are open source. We encourage contributions from the
community, be it new features, small fixes or adjustments, or even large additions to the system. Have a look at the
[contributing guide](/docs/developers/contributing/overview) to get started.
