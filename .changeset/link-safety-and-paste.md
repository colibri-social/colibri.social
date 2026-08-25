---
"@colibri-social/client": patch
"@colibri-social/lib": patch
---

Paste a link over selected text to turn it into a markdown link, refuse to render a link whose label claims a different host than its target, and confirm before opening a link that leaves Colibri

<!-- whatsnew
title: Safer, better links
icon: link-fill
body: Pasting a link while text is selected now wraps it into a markdown link. A link whose visible text claims one site while pointing at another shows as plain text instead, and opening a link that leaves Colibri asks first and shows the full address. You can turn that confirmation off in Settings > Preferences.
platforms: all
kind: feature
-->
