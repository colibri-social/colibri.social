---
"@colibri-social/lib": patch
"@colibri-social/client": patch
"@colibri-social/website": patch
---

Fixes formatting markers being scrambled when a message is reopened for editing. A list item that started with an inline style came back inside out (`- **Test**` turned into `**- Test**`), which also corrupted the facets once the edit was saved. Headings and subtext were affected the same way whenever the inline style covered only part of the line, and copying a styled list item to the clipboard produced the same wrong text.

<!-- whatsnew
title: Editing formatted lists
icon: list-bullets-fill
body: Editing a message that contains a bold or italic list item no longer scrambles the formatting.
kind: fix
-->
