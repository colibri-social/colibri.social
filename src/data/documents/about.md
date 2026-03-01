---
eyebrow: "Hatching a social platform."
title: "ABOUT COLIBRI"
description: "Learn more about what Colibri is, why we built it, and why you should use it."
---

## What is Colibri?

Colibri is a chat app, similar to Discord, built on the AT Protocol (also called Atproto). It was originally
built by [@lou.gg](https://bsky.app/profile/lou.gg) and [@otterlord.dev](https://bsky.app/profile/otterlord.dev)
as a side project to figure out whether real-time chat applications on Atproto were possible. At the time, Discord
announced that they'd be introducing face scans to their app, which was the reason for the exploration of alternatives.

## How does Colibri work?

<small class="text-muted-foreground">If you end up getting confused with some of the terms here, check out the [Atproto Glossary of Terms](https://atproto.com/guides/glossary)!</small>

Colibri follows the recommended Atproto architecture is a collection of services. It consists of:

- A public-facing [Jetstream](https://atproto.com/guides/streaming-data) instance, hosted at [jetstream.colibri.social](https://jetstream.colibri.social)
- A public-facing [App View](https://atproto.com/guides/glossary#app-view), hosted at [appview.colibri.social](https://appview.colibri.social)
- A [PDS](https://atproto.com/guides/glossary#pds-personal-data-server), hosted at [colibri.social](https://colibri.social)
- The website and web-abb, also hosted at [colibri.social](https://colibri.social)

When you sign in to Colibri, we contact the PDS hosting your data and redirect you to it, asking you to authenticate. Once you've logged in and are redirected back to us,
we check for some basic records in your PDS. We then create them if they do not yet exist.

Once you're in the app, you can start creating communities, categories, and channels. You can send and react to messages, change settings, et cetera. The event flow for this is quite interesting.
Whenever you create _anything_, we send a request to your PDS on your behalf to create a record of that type.

For the purpose of this explanation, let's say you want to post a message. When you open a channel, your client connects to our App View via a WebSocket connection.
Whenever you've typed in your message and hit Enter, the request that you'd like to create a new message record is sent to your PDS. At the same time, we display your
message with gray text in the chat and wait. Next, as soon as the record is created, your PDS will notify (one of) the configured [Relay(s)](https://atproto.com/guides/glossary#relay)
that a new record has been created. The Relay will then fetch the data for this record from the PDS and announce the record creation to the network via a firehose stream.
Our Jetstream instance is listening to that firehose, and our App View is listening to the Jetstream. As soon as the App View catches wind of the message being created,
it makes a copy of the record in a PostgreSQL database for indexing purposes. After that, it uses the aforementioned WebSocket connection to notify all clients that are
currently viewing the channel you sent your message in that a new message has been posted. At that moment, your client realizes that the message has now been published,
and we switch the text color from gray to white. Not exactly simple, but not exactly complicated either, right?

## Why not go proprietary?

A few reasons. First, the modern internet is rapidly becoming more and more closed off. Initiatives like Atproto make sure that the Internet and it's communities stay open, and provide
you with the tools to own your images, data, and identity, and we want to support this. Second, it saves on development time. Figuring out a real-time chat system is no easy feat, and
Atproto just so happened to be a decent fit for the prototype.

## I like what I'm reading. Can I help out?

Yes, please! Both of the pieces of Software we've made, the [App View](https://github.com/colibri-social/appview) and [Website & App](https://github.com/colibri-social/colibri.social) are open source.
We encourage contributions by the community, be it for new features, small fixes or adjustments, or even large additions to the system.
