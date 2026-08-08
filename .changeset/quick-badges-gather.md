---
"@colibri-social/client": patch
---

Fixes badge labels issuing one request per user. Every rendered name used to hit the labeler separately, so opening a large member list or a role mention popover fired dozens of requests at once. Names rendered without a badge no longer request one at all, the rest are coalesced into a single batched query, and a failed lookup no longer hides badges for fifteen minutes.

<!-- whatsnew
title: Faster member lists
icon: lightning-fill
body: Member lists and role popovers no longer stall while badges load.
kind: fix
-->
