---
"@colibri-social/client": minor
---

Profile badges are now defined by the labeler instead of being hardcoded in the client. The labeler publishes its badge catalogue as a `social.colibri.labeler.service` record, and the client reads it at runtime, so adding a badge or recolouring one no longer needs a client release. Every piece of badge display metadata used to be duplicated across three hand-maintained maps in the client plus the labeler's own list, and the copies could drift.

`#badgeDefinition` gains an optional `appearance` holding a `variant` of `solid` or `gradientBorder`, a list of `colors` and a `foreground`. Every colour is a `#rrggbb` or `#rrggbbaa` hex literal, validated on the way in, so a badge's colours reach the DOM as an inline style without the record being able to inject arbitrary CSS. A badge whose appearance is missing or unusable still renders, with the neutral fallback style.

The catalogue is read from the labeler's own PDS, cached for an hour in memory and IndexedDB, and backed by a bundled copy of the current badges, so badges render immediately on a cold start and keep rendering if the labeler is unreachable. A badge the record lists without an appearance keeps its bundled colours rather than dropping to the neutral style, so nothing changes appearance until the labeler actually publishes new colours. The `Badge` component now takes just the label value and looks up its own text, description and colours.
