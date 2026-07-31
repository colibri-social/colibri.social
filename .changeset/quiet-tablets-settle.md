---
"@colibri-social/client": patch
"@colibri-social/website": patch
---

Fixes the Settings dialog (and every other modal/popover/drawer built on the same primitive) rendering with clipped text and mis-centering on iPad-width screens, flagged during App Store review. Dialogs no longer size themselves off the viewport width, which was the root cause on tablet-sized screens, long channel names now truncate instead of overlapping the mute/member-list buttons at narrower chat widths.
