---
"@colibri-social/client": minor
"@colibri-social/website": patch
---

Replaces the plain text loading screen with an animated hummingbird.

The bird hovers with a photographic wing blur: ghost copies of each wing are sampled uniformly in time through a sinusoidal stroke, so they cluster at the stroke reversals and smear through the fast mid-stroke, with per-copy blur scaled to stroke velocity. Wings collapse along their own long axis rather than swinging, which keeps them at the side of the body where a real hummingbird's are. The hover-bob runs on its own clock, independent of the wingbeat.

One bird now covers the whole boot instead of one per gate, so it stays on screen while sign-in hands off to the user load and then the community load, cycling status lines with bird-themed flavour in between. Wings beat lazily while connecting and settle into their resting tempo while syncing. After eight seconds the bird tires, slows its bob, sinks a little and switches to honest status lines. When everything is ready the status line fades out and the bird darts off screen. Tapping the bird startles it into hopping away from your finger with a burst of faster wingbeats.

Reduced motion collapses all of it to the static artwork. The same bird also replaces the two floating logos on the homepage, hydrating on scroll and pausing when it leaves the viewport.

<!-- whatsnew
title: A hummingbird while you wait
icon: bird-fill
body: Loading screens now show a hovering hummingbird instead of plain text, with status lines that keep you company while the app starts up. Tap it if you want to see it startle.
kind: feature
-->
