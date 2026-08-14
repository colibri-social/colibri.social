---
"@colibri-social/client": patch
---

Scrolling to the top of a channel no longer runs away. The scroll surface identified message rows by an attribute that sits below the row element, so every anchor capture came up empty and restoring the reading position after older messages mounted was a silent no-op. The reader stayed at the top, which immediately asked for the next page, and the messages they were reading were pushed down out of view. Rows are now resolved through their wrapper elements, older pages are compensated even while a scroll gesture is still running, late-loading embeds above the fold no longer shift the view mid-scroll, and the self-driven prefetch chain stops instead of spinning if a page ever fails to compensate. The backfill cursor also advances past the whole fetched page now, so overlapping pages cannot cause round-trips that make no progress.

<!-- whatsnew
title: Scrolling up through history stays put
icon: arrow-up-fill
platforms: all
kind: fix
body: Older messages now load in directly above the oldest one you have, with no jump and no runaway loading when you reach the top of a channel.
-->
