---
"@colibri-social/client": patch
---

Show everyone who is actually in a voice channel, and keep one account to one call.

The first person to join a channel was invisible to everyone who joined after them: the roster sync was handed a bare DID where it wanted a community authority, so it bailed out and never seeded anyone. The call socket now also reports who is already in the room, so a missed event no longer loses a participant.

Joining from a second device takes the call over and tells the first device why, instead of leaving you in two places at once.

Along with it:

- A screen share or camera tile no longer haunts the floating window after you leave a call and rejoin. Clearing the tiles was a no-op, and a failed share left one behind too.
- Leaving and rejoining within a few hundred milliseconds of stopping a share no longer tears down the session you just started.
- Double-clicking Join no longer opens a second connection, so nobody hears you twice.
- A dropped connection during setup reconnects instead of showing an error, the call panel stays on screen while it retries, and giving up says so.
- A request the server never answers times out and reconnects instead of silently freezing every later one.
- The microphone is released when setup fails, so the recording indicator no longer stays lit until you close the app.
- A moderator muting you no longer rewrites your own saved preference, so your next call is not stuck muted.
- Audio from someone who left mid-connect no longer keeps playing, and a stream announced twice is only played once.
- Being disconnected for losing access to a channel now says so.
- STUN and TURN servers the voice server advertises are used, which needs `@colibri-social/lexicons` 2.5.0.
- Removed the "hear yourself" microphone test, which spoke a protocol the server no longer serves and had been failing silently. The input level meter is unaffected.
