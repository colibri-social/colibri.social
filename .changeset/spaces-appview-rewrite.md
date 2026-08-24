---
"@colibri-social/client": major
"@colibri-social/wrapper": major
---

Move the client onto permissioned spaces

A community's data is gated by the community's own PDS rather than being public,
and the client writes your messages and reactions into your own repository. The
AppView indexes them and serves the views the app renders. Your preferences,
mutes and saved GIFs live in a personal space that you grant the AppView access
to.

Channels can restrict who reads them, separately from who may post. Hiding a
message applies a label a moderator can retract, and the author keeps seeing
their own message. Banning and kicking leave everything the member wrote in
place.

A community can name a different AppView as the holder of its credentials, and
the client talks to that AppView for that community's reads, writes, events and
voice. You can adopt an account you already own as a community, or move a
repo-backed community across.

Everyone signs in again once, because the permission sets changed. The default
AppView origin is now `https://spaces-api.colibri.social`, and a host you chose
yourself is left as it is.

The chat guidelines dialog is gone, and nothing stands between you and the
composer any more.

A server that runs without voice says so, and Colibri no longer offers to join
a call it cannot connect.

The member list now shows the people who can see the channel you are in, rather
than everyone in the community.

Link previews load their image and video through Colibri rather than the site
they came from, so opening a channel no longer tells every linked site who is
reading. Invite links point at whichever Colibri you are using, and an
invite or channel link pasted into a message is recognised no matter which
one it came from.

Your mutes, notification setting and community order follow you between devices
while both are open, and a call tells you why it ended when the server drops
you.

<!-- whatsnew
title: Private communities
icon: lock-key-fill
body: Your messages now live in your own repository and Colibri indexes them
  rather than holding them. Channels can be private, with reading gated
  separately from posting. Hiding a message is reversible, and banning someone
  leaves what they wrote in place. A community can also be hosted by a different
  Colibri server, and you can bring an account you already own.
platforms: all
kind: feature
-->
