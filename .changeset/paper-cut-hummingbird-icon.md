---
"@colibri-social/wrapper": patch
"@colibri-social/assets": patch
"@colibri-social/website": patch
---

Swaps in the new paper-cut hummingbird as the app icon everywhere: desktop, iOS, Android, Windows, the favicons, the web app manifest, and the sign-in provider list.

Android 13 and newer now get a monochrome layer, so launchers that tint icons to the wallpaper palette render Colibri properly instead of falling back to the untinted foreground. The adaptive foreground is also rendered separately at each density and inset to the safe zone, which fixes the beak and tail being clipped by round and squircle launcher masks. The status bar notification icon is redrawn from the same artwork.

The three vector variants of the mark are committed under `packages/assets/brand`, and every raster target is rendered from them by `pnpm brand:render`, so the icon set is reproducible rather than a pile of hand-exported files. `favicon.svg` drops from 300 KB of base64-encoded PNG to a 15 KB vector along the way.

<!-- whatsnew
title: A new app icon
icon: sparkle-fill
body: Colibri has a new app icon, a paper-cut hummingbird. On Android 13 and newer it also picks up your wallpaper colours if your launcher tints icons.
kind: feature
-->
