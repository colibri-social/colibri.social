---
"@colibri-social/client": minor
---

Reworks noise suppression into strength tiers. Behind a new Experiments toggle, three research denoisers are also selectable: **Experimental (DTLN)**, **Experimental (GTCRN)** and **Experimental (UL-UNAS)**. They run at 16 kHz through a shared resampling host and only download their models when one is picked.

<!-- whatsnew
title: Experimental noise suppressors
icon: waveform-fill
body: Enable the "Noise suppression" experiment to try out three new noise cancelling algorithms!
kind: feature
-->
